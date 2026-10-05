import type { AgentDTO, ChannelDTO, MessageDTO, UserDTO, WorkspaceDTO, MemberDTO } from '@slack/shared';
import type { AgentDoc } from '../models/Agent.js';
import type { ChannelDoc } from '../models/Channel.js';
import type { MessageDoc } from '../models/Message.js';
import type { UserDoc } from '../models/User.js';
import type { WorkspaceDoc } from '../models/Workspace.js';

export const toUserDTO = (u: UserDoc): UserDTO => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarColor: u.avatarColor,
});

export const toMemberDTO = (u: UserDoc): MemberDTO => ({ id: u.id, name: u.name, avatarColor: u.avatarColor });

export const toWorkspaceDTO = (w: WorkspaceDoc, members: UserDoc[]): WorkspaceDTO => ({
  id: w.id,
  name: w.name,
  ownerId: w.ownerId.toString(),
  inviteCode: w.inviteCode,
  members: members.map(toMemberDTO),
});

export const toChannelDTO = (c: ChannelDoc): ChannelDTO => ({
  id: c.id,
  workspaceId: c.workspaceId.toString(),
  name: c.name,
  description: c.description ?? '',
  agentIds: c.agentIds.map((a) => a.toString()),
  createdAt: c.createdAt.toISOString(),
});

export const toAgentDTO = (a: AgentDoc): AgentDTO => ({
  id: a.id,
  workspaceId: a.workspaceId.toString(),
  name: a.name,
  handle: a.handle,
  avatar: a.avatar ?? '🤖',
  description: a.description ?? '',
  systemPrompt: a.systemPrompt,
  model: a.model,
  temperature: a.temperature ?? 0.7,
  contextWindow: a.contextWindow ?? 20,
  isBuiltIn: a.isBuiltIn ?? false,
  createdAt: a.createdAt.toISOString(),
});

export const toMessageDTO = (m: MessageDoc): MessageDTO => ({
  id: m.id,
  workspaceId: m.workspaceId.toString(),
  channelId: m.channelId.toString(),
  threadId: m.threadId ? m.threadId.toString() : null,
  author: {
    kind: m.author.kind,
    id: m.author.id ? m.author.id.toString() : null,
    name: m.author.name,
    avatar: m.author.avatar,
  },
  content: m.content ?? '',
  status: m.status,
  error: m.error ?? undefined,
  usage: m.usage
    ? {
        promptTokens: m.usage.promptTokens ?? undefined,
        completionTokens: m.usage.completionTokens ?? undefined,
        latencyMs: m.usage.latencyMs ?? undefined,
        model: m.usage.model ?? undefined,
      }
    : undefined,
  replyCount: m.replyCount ?? 0,
  lastReplyAt: m.lastReplyAt ? m.lastReplyAt.toISOString() : null,
  createdAt: m.createdAt.toISOString(),
  updatedAt: m.updatedAt.toISOString(),
});
