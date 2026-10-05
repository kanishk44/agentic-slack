import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useMessageStore } from '@/stores/messageStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';

/** Connects the socket and wires server events into the stores. Returns connection state. */
export function useSocketEvents() {
  const [connected, setConnected] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    const msg = useMessageStore.getState();
    const ws = useWorkspaceStore.getState();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onAgentDeleted = ({ agentId }: { agentId: string }) => ws.removeAgent(agentId);
    const onTyping = ({ channelId, userId: typingUserId, name }: { channelId: string; userId: string; name: string }) => {
      if (typingUserId !== userId) msg.setTyping(channelId, typingUserId, name);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', msg.upsert);
    socket.on('message:updated', msg.upsert);
    socket.on('message:complete', msg.upsert);
    socket.on('message:error', msg.upsert);
    socket.on('message:delta', msg.applyDelta);
    socket.on('agent:status', ws.setAgentStatus);
    socket.on('workspace:upserted', ws.upsertWorkspace);
    socket.on('channel:upserted', ws.upsertChannel);
    socket.on('agent:upserted', ws.upsertAgent);
    socket.on('agent:deleted', onAgentDeleted);
    socket.on('typing', onTyping);

    if (!socket.connected) socket.connect();
    else setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', msg.upsert);
      socket.off('message:updated', msg.upsert);
      socket.off('message:complete', msg.upsert);
      socket.off('message:error', msg.upsert);
      socket.off('message:delta', msg.applyDelta);
      socket.off('agent:status', ws.setAgentStatus);
      socket.off('workspace:upserted', ws.upsertWorkspace);
      socket.off('channel:upserted', ws.upsertChannel);
      socket.off('agent:upserted', ws.upsertAgent);
      socket.off('agent:deleted', onAgentDeleted);
      socket.off('typing', onTyping);
    };
  }, [userId]);

  return connected;
}

/** Joins a channel's realtime room (re-joining after reconnects). */
export function useChannelRoom(channelId: string | undefined) {
  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();
    const join = () => {
      socket.emit('channel:join', channelId);
      // Catch up on anything missed while disconnected.
      void useMessageStore.getState().loadChannel(channelId).catch(() => undefined);
    };
    if (socket.connected) socket.emit('channel:join', channelId);
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit('channel:leave', channelId);
    };
  }, [channelId]);
}
