import { Types, isValidObjectId } from 'mongoose';
import { extractHandles, type MessageDTO, type SendMessageInput } from '@slack/shared';
import { badRequest, notFound } from '../lib/errors.js';
import { channelRoom, getIO, workspaceRoom } from '../lib/io.js';
import { createLogger } from '../lib/logger.js';
import { toChannelDTO, toMessageDTO } from '../lib/serializers.js';
import { assertMember } from '../middleware/workspaceMember.js';
import { AgentModel } from '../models/Agent.js';
import { ChannelModel, type ChannelDoc } from '../models/Channel.js';
import { MessageModel, type MessageDoc } from '../models/Message.js';
import { UserModel } from '../models/User.js';
import { enqueueAgentRun } from './agentRunner.js';
import { bumpReplyCount } from './threadService.js';

const log = createLogger('messages');

export async function loadChannelForUser(channelId: string, userId: string): Promise<ChannelDoc> {
  if (!isValidObjectId(channelId)) throw notFound('Channel not found');
  const channel = await ChannelModel.findById(channelId);
  if (!channel) throw notFound('Channel not found');
  await assertMember(channel.workspaceId.toString(), userId);
  return channel;
}

/** Persists a human message, broadcasts it, and dispatches any @mentioned agents. */
export async function sendUserMessage(userId: string, input: SendMessageInput): Promise<MessageDTO> {
  const channel = await loadChannelForUser(input.channelId, userId);
  const user = await UserModel.findById(userId);
  if (!user) throw notFound('User not found');

  let threadRoot: MessageDoc | null = null;
  if (input.threadId) {
    if (!isValidObjectId(input.threadId)) throw badRequest('Invalid thread');
    threadRoot = await MessageModel.findById(input.threadId);
    if (!threadRoot || !threadRoot.channelId.equals(channel._id)) throw notFound('Thread not found');
    if (threadRoot.threadId) throw badRequest('Cannot reply to a reply');
  }

  const handles = extractHandles(input.content);
  const agents = handles.length
    ? await AgentModel.find({ workspaceId: channel.workspaceId, handle: { $in: handles } })
    : [];

  const message = await MessageModel.create({
    workspaceId: channel.workspaceId,
    channelId: channel._id,
    threadId: threadRoot?._id ?? null,
    author: { kind: 'user', id: user._id, name: user.name, avatar: user.avatarColor },
    content: input.content,
    mentions: agents.map((a) => ({ kind: 'agent', id: a._id })),
  });

  const io = getIO();
  const dto = toMessageDTO(message);
  io.to(channelRoom(channel.id)).emit('message:new', dto);
  if (threadRoot) await bumpReplyCount(threadRoot._id, message.createdAt);

  log.info('Message created', {
    messageId: message.id,
    channelId: channel.id,
    threadId: threadRoot?.id ?? null,
    userId,
    length: input.content.length,
    mentionedAgents: agents.map((a) => a.handle),
    unknownHandles: handles.filter((h) => !agents.some((a) => a.handle === h)),
  });

  if (agents.length) {
    // Mentioning an agent that isn't in the channel invites it, Slack-style.
    const missing = agents.filter((a) => !channel.agentIds.some((id) => id.equals(a._id)));
    if (missing.length) {
      channel.agentIds.push(...missing.map((a) => a._id));
      await channel.save();
      io.to(workspaceRoom(channel.workspaceId.toString())).emit('channel:upserted', toChannelDTO(channel));
      const note = await MessageModel.create({
        workspaceId: channel.workspaceId,
        channelId: channel._id,
        author: { kind: 'system', id: null, name: 'Agentic Slack', avatar: '⚡' },
        content: `${missing.map((a) => `**${a.name}**`).join(', ')} joined #${channel.name} after being mentioned by ${user.name}.`,
      });
      io.to(channelRoom(channel.id)).emit('message:new', toMessageDTO(note));
      log.info('Agents auto-added to channel', { channelId: channel.id, agents: missing.map((a) => a.handle) });
    }

    const threadRootId: Types.ObjectId = threadRoot?._id ?? message._id;
    for (const agent of agents) {
      enqueueAgentRun({ agent, channel, threadRootId, triggerMessageId: message._id });
    }
  }

  return dto;
}

/** Regenerates a failed agent reply in place. */
export async function retryAgentMessage(userId: string, messageId: string) {
  if (!isValidObjectId(messageId)) throw notFound('Message not found');
  const message = await MessageModel.findById(messageId);
  if (!message || message.author.kind !== 'agent' || !message.threadId) throw notFound('Message not found');
  const channel = await loadChannelForUser(message.channelId.toString(), userId);
  if (message.status !== 'error') throw badRequest('Only failed replies can be retried');
  const agent = await AgentModel.findById(message.author.id);
  if (!agent) throw notFound('This agent no longer exists');

  log.info('Retrying agent message', { messageId, agent: agent.handle, userId });
  const queued = enqueueAgentRun({
    agent,
    channel,
    threadRootId: message.threadId,
    triggerMessageId: message._id,
    existingMessage: message,
  });
  if (!queued) throw badRequest(`${agent.name} is already replying in this thread`);
}
