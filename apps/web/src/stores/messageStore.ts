import { create } from 'zustand';
import type { MessageDTO, Paginated, SendMessageInput } from '@slack/shared';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface ChannelMessages {
  items: MessageDTO[];
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

interface ThreadState {
  root: MessageDTO | null;
  replies: MessageDTO[];
  loading: boolean;
}

interface MessageState {
  channels: Record<string, ChannelMessages>;
  threads: Record<string, ThreadState>;
  typing: Record<string, Record<string, { name: string; at: number }>>;

  loadChannel: (channelId: string) => Promise<void>;
  loadOlder: (channelId: string) => Promise<number>;
  loadThread: (rootId: string) => Promise<void>;
  send: (input: SendMessageInput) => Promise<MessageDTO>;
  retry: (messageId: string) => Promise<void>;

  upsert: (message: MessageDTO) => void;
  applyDelta: (payload: { messageId: string; channelId: string; threadId: string | null; delta: string }) => void;
  setTyping: (channelId: string, userId: string, name: string) => void;
}

const emptyChannel: ChannelMessages = { items: [], hasMore: false, loading: false, loaded: false };

function upsertSorted(list: MessageDTO[], message: MessageDTO): MessageDTO[] {
  const idx = list.findIndex((m) => m.id === message.id);
  if (idx !== -1) {
    const next = list.slice();
    next[idx] = message;
    return next;
  }
  const next = [...list, message];
  // Messages almost always arrive in order; only sort when they don't.
  if (list.length && list[list.length - 1].createdAt > message.createdAt) {
    next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return next;
}

function patchMessage(list: MessageDTO[], id: string, fn: (m: MessageDTO) => MessageDTO): MessageDTO[] {
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return list;
  const next = list.slice();
  next[idx] = fn(next[idx]);
  return next;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  channels: {},
  threads: {},
  typing: {},

  loadChannel: async (channelId) => {
    const current = get().channels[channelId];
    if (current?.loading) return;
    set((s) => ({ channels: { ...s.channels, [channelId]: { ...(current ?? emptyChannel), loading: true } } }));
    try {
      const page = await api.get<Paginated<MessageDTO>>(`/channels/${channelId}/messages?limit=50`);
      set((s) => {
        // Keep any live messages that arrived while the request was in flight.
        const live = s.channels[channelId]?.items ?? [];
        const merged = live.reduce(upsertSorted, page.items);
        return { channels: { ...s.channels, [channelId]: { items: merged, hasMore: page.hasMore, loading: false, loaded: true } } };
      });
    } catch (err) {
      set((s) => ({ channels: { ...s.channels, [channelId]: { ...(s.channels[channelId] ?? emptyChannel), loading: false } } }));
      throw err;
    }
  },

  loadOlder: async (channelId) => {
    const current = get().channels[channelId];
    if (!current || current.loading || !current.hasMore || !current.items.length) return 0;
    set((s) => ({ channels: { ...s.channels, [channelId]: { ...current, loading: true } } }));
    const before = encodeURIComponent(current.items[0].createdAt);
    const page = await api.get<Paginated<MessageDTO>>(`/channels/${channelId}/messages?limit=50&before=${before}`);
    set((s) => {
      const c = s.channels[channelId] ?? emptyChannel;
      return { channels: { ...s.channels, [channelId]: { ...c, items: [...page.items, ...c.items], hasMore: page.hasMore, loading: false } } };
    });
    return page.items.length;
  },

  loadThread: async (rootId) => {
    set((s) => ({ threads: { ...s.threads, [rootId]: { root: s.threads[rootId]?.root ?? null, replies: s.threads[rootId]?.replies ?? [], loading: true } } }));
    const { root, replies } = await api.get<{ root: MessageDTO; replies: MessageDTO[] }>(`/messages/${rootId}/thread`);
    set((s) => {
      const live = s.threads[rootId]?.replies ?? [];
      return { threads: { ...s.threads, [rootId]: { root, replies: live.reduce(upsertSorted, replies), loading: false } } };
    });
  },

  send: (input) =>
    new Promise((resolve, reject) => {
      getSocket()
        .timeout(15_000)
        .emit('message:send', input, (err, res) => {
          if (err) return reject(new Error('The server did not respond. Check your connection.'));
          if (!res.ok) return reject(new Error(res.error));
          get().upsert(res.data);
          resolve(res.data);
        });
    }),

  retry: async (messageId) => {
    await api.post(`/messages/${messageId}/retry`);
  },

  upsert: (message) =>
    set((s) => {
      if (message.threadId) {
        const thread = s.threads[message.threadId];
        if (!thread) return {};
        return { threads: { ...s.threads, [message.threadId]: { ...thread, replies: upsertSorted(thread.replies, message) } } };
      }
      const channel = s.channels[message.channelId] ?? emptyChannel;
      const thread = s.threads[message.id];
      return {
        channels: { ...s.channels, [message.channelId]: { ...channel, items: upsertSorted(channel.items, message) } },
        threads: thread ? { ...s.threads, [message.id]: { ...thread, root: message } } : s.threads,
      };
    }),

  applyDelta: ({ messageId, channelId, threadId, delta }) =>
    set((s) => {
      const append = (m: MessageDTO) => ({ ...m, content: m.content + delta });
      if (threadId && s.threads[threadId]) {
        const thread = s.threads[threadId];
        return { threads: { ...s.threads, [threadId]: { ...thread, replies: patchMessage(thread.replies, messageId, append) } } };
      }
      const channel = s.channels[channelId];
      if (!channel) return {};
      return { channels: { ...s.channels, [channelId]: { ...channel, items: patchMessage(channel.items, messageId, append) } } };
    }),

  setTyping: (channelId, userId, name) =>
    set((s) => ({ typing: { ...s.typing, [channelId]: { ...s.typing[channelId], [userId]: { name, at: Date.now() } } } })),
}));
