export type AuthorKind = 'user' | 'agent' | 'system';
export type MessageStatus = 'complete' | 'streaming' | 'error';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface MemberDTO {
  id: string;
  name: string;
  avatarColor: string;
}

export interface WorkspaceDTO {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  members: MemberDTO[];
}

export interface ChannelDTO {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  agentIds: string[];
  createdAt: string;
}

export interface AgentDTO {
  id: string;
  workspaceId: string;
  name: string;
  handle: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  contextWindow: number;
  isBuiltIn: boolean;
  createdAt: string;
}

export interface MessageAuthorDTO {
  kind: AuthorKind;
  id: string | null;
  name: string;
  /** Emoji for agents, hex color for users. */
  avatar: string;
}

export interface MessageUsageDTO {
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  model?: string;
}

export interface MessageDTO {
  id: string;
  workspaceId: string;
  channelId: string;
  threadId: string | null;
  author: MessageAuthorDTO;
  content: string;
  status: MessageStatus;
  error?: string;
  usage?: MessageUsageDTO;
  replyCount: number;
  lastReplyAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FreeModelDTO {
  id: string;
  name: string;
  contextLength: number;
}

export interface Paginated<T> {
  items: T[];
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
