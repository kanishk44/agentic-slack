import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Hash } from 'lucide-react';
import { extractHandles, type AgentDTO, type ChannelDTO, type MessageDTO } from '@slack/shared';
import { useChannelRoom } from '@/hooks/useSocketEvents';
import { errorMessage } from '@/lib/api';
import { useMessageStore } from '@/stores/messageStore';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ChannelHeader } from '@/components/layout/ChannelHeader';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import { MessageList } from '@/components/messages/MessageList';
import { AgentAvatar } from '@/components/messages/AuthorAvatar';
import { Composer, type ComposerHandle } from '@/components/composer/Composer';
import { TypingIndicator } from '@/components/composer/TypingIndicator';
import { ThreadPanel } from '@/components/thread/ThreadPanel';

const STARTERS: Record<string, string> = {
  frontend: 'build an accessible, responsive navbar in React + Tailwind',
  essay: 'write a 300-word essay on why remote work changed cities',
  reviewer: 'review this function:\n```js\nfunction sum(a) { let t; for (i in a) t += a[i]; return t }\n```',
  researcher: 'compare PostgreSQL vs MongoDB for a chat app',
  pm: 'write user stories for a "save draft" feature',
};

function ChannelIntro({ channel, agents, onStarter }: { channel: ChannelDTO; agents: AgentDTO[]; onStarter: (text: string) => void }) {
  const inChannel = agents.filter((a) => channel.agentIds.includes(a.id));
  const showcase = inChannel.length ? inChannel : agents.slice(0, 3);
  return (
    <div className="px-4 pb-4 pt-10">
      <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-muted">
        <Hash className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold">Welcome to #{channel.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This is the very beginning of #{channel.name}. {channel.description}
      </p>
      {showcase.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try asking an agent</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.slice(0, 6).map((a) => (
              <button
                key={a.id}
                onClick={() => onStarter(`@${a.handle} ${STARTERS[a.handle] ?? ''}`)}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left text-sm transition hover:border-primary/40 hover:shadow-sm"
              >
                <AgentAvatar emoji={a.avatar} />
                <div className="min-w-0">
                  <div className="font-medium">{a.name}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{STARTERS[a.handle] ?? a.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChannelView() {
  const { channelId } = useParams<{ channelId: string }>();
  const channel = useWorkspaceStore((s) => s.channels.find((c) => c.id === channelId));
  const agents = useWorkspaceStore((s) => s.agents);
  const state = useMessageStore((s) => (channelId ? s.channels[channelId] : undefined));
  const loadChannel = useMessageStore((s) => s.loadChannel);
  const loadOlder = useMessageStore((s) => s.loadOlder);
  const openThreadId = useUIStore((s) => s.openThreadId);
  const openThread = useUIStore((s) => s.openThread);
  const closeThread = useUIStore((s) => s.closeThread);
  const composerRef = useRef<ComposerHandle>(null);

  useChannelRoom(channelId);

  useEffect(() => {
    if (!channelId) return;
    closeThread();
    loadChannel(channelId).catch((err) => toast.error(errorMessage(err)));
  }, [channelId, loadChannel, closeThread]);

  const onLoadOlder = useCallback(() => (channelId ? loadOlder(channelId) : Promise.resolve(0)), [channelId, loadOlder]);

  // When a top-level message pings agents, open its thread so the replies stream in view.
  const onSent = useCallback(
    (message: MessageDTO) => {
      const handles = new Set(extractHandles(message.content));
      if (agents.some((a) => handles.has(a.handle))) openThread(message.id);
    },
    [agents, openThread],
  );

  if (!channel || !channelId) return <FullPageSpinner />;

  const threadVisible = openThreadId && state?.items.some((m) => m.id === openThreadId);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChannelHeader channel={channel} />
        {!state?.loaded ? (
          <FullPageSpinner />
        ) : (
          <MessageList
            resetKey={channelId}
            messages={state.items}
            hasMore={state.hasMore}
            loading={state.loading}
            onLoadOlder={onLoadOlder}
            onOpenThread={openThread}
            header={<ChannelIntro channel={channel} agents={agents} onStarter={(t) => composerRef.current?.insert(t)} />}
          />
        )}
        <div className="px-4 pb-2">
          <Composer ref={composerRef} channelId={channelId} placeholder={`Message #${channel.name} — type @ to mention an agent`} onSent={onSent} autoFocus />
          <TypingIndicator channelId={channelId} />
        </div>
      </div>
      {threadVisible && <ThreadPanel rootId={openThreadId} channelId={channelId} channelName={channel.name} />}
    </div>
  );
}
