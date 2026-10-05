import type { AgentDTO, ChannelDTO, MessageDTO, WorkspaceDTO } from './types.js';
import type { SendMessageInput } from './schemas.js';

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface AgentStatusPayload {
  agentId: string;
  channelId: string;
  threadId: string | null;
  state: 'thinking' | 'idle';
}

export interface ServerToClientEvents {
  'message:new': (message: MessageDTO) => void;
  'message:delta': (payload: { messageId: string; channelId: string; threadId: string | null; delta: string }) => void;
  'message:complete': (message: MessageDTO) => void;
  'message:error': (message: MessageDTO) => void;
  /** Parent message metadata changed (e.g. replyCount). */
  'message:updated': (message: MessageDTO) => void;
  'agent:status': (payload: AgentStatusPayload) => void;
  'typing': (payload: { channelId: string; userId: string; name: string }) => void;
  /** Workspace-scoped events (sent to every member of the workspace). */
  'workspace:upserted': (workspace: WorkspaceDTO) => void;
  'channel:upserted': (channel: ChannelDTO) => void;
  'agent:upserted': (agent: AgentDTO) => void;
  'agent:deleted': (payload: { agentId: string; workspaceId: string }) => void;
}

export interface ClientToServerEvents {
  'channel:join': (channelId: string, ack?: Ack<null>) => void;
  'channel:leave': (channelId: string) => void;
  'message:send': (input: SendMessageInput, ack: Ack<MessageDTO>) => void;
  'typing': (channelId: string) => void;
}
