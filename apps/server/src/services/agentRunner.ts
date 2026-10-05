import pLimit from 'p-limit';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { channelRoom, getIO } from '../lib/io.js';
import { createLogger } from '../lib/logger.js';
import { toMessageDTO } from '../lib/serializers.js';
import { AgentModel, type AgentDoc } from '../models/Agent.js';
import type { ChannelDoc } from '../models/Channel.js';
import { MessageModel, type MessageDoc } from '../models/Message.js';
import { UserModel } from '../models/User.js';
import { WorkspaceModel } from '../models/Workspace.js';
import { buildContext } from './contextBuilder.js';
import { OpenRouterError, streamChat } from './openrouter.js';
import { bumpReplyCount } from './threadService.js';

const log = createLogger('agentRunner');

const limit = pLimit(env.AGENT_CONCURRENCY);
/** `${agentId}:${threadRootId}` — prevents the same agent replying twice in parallel in one thread. */
const inFlight = new Set<string>();

const DELTA_FLUSH_MS = 50;

export interface AgentRunRequest {
  agent: AgentDoc;
  channel: ChannelDoc;
  threadRootId: Types.ObjectId;
  /** Message that triggered the run (for logs). */
  triggerMessageId: Types.ObjectId;
  /** Re-use an existing (errored) agent message instead of creating a new one. */
  existingMessage?: MessageDoc;
}

export function enqueueAgentRun(req: AgentRunRequest): boolean {
  const key = `${req.agent.id}:${req.threadRootId.toString()}`;
  if (inFlight.has(key)) {
    log.info('Agent already replying in this thread, skipping', { agentId: req.agent.id, threadId: req.threadRootId.toString() });
    return false;
  }
  inFlight.add(key);
  log.info('Agent run queued', {
    agent: req.agent.handle,
    agentId: req.agent.id,
    channelId: req.channel.id,
    threadId: req.threadRootId.toString(),
    triggerMessageId: req.triggerMessageId.toString(),
    queued: limit.pendingCount,
    active: limit.activeCount,
  });
  void limit(() => runAgent(req))
    .catch((err) => log.error('Agent run crashed', { err, agentId: req.agent.id }))
    .finally(() => inFlight.delete(key));
  return true;
}

async function runAgent({ agent, channel, threadRootId, triggerMessageId, existingMessage }: AgentRunRequest) {
  const io = getIO();
  const room = channelRoom(channel.id);
  const threadId = threadRootId.toString();
  const logCtx = { agent: agent.handle, agentId: agent.id, channelId: channel.id, threadId, model: agent.model };

  let message: MessageDoc;
  if (existingMessage) {
    existingMessage.content = '';
    existingMessage.status = 'streaming';
    existingMessage.error = undefined;
    existingMessage.usage = undefined;
    message = await existingMessage.save();
    io.to(room).emit('message:updated', toMessageDTO(message));
  } else {
    message = await MessageModel.create({
      workspaceId: channel.workspaceId,
      channelId: channel._id,
      threadId: threadRootId,
      author: { kind: 'agent', id: agent._id, name: agent.name, avatar: agent.avatar ?? '🤖' },
      content: '',
      status: 'streaming',
    });
    io.to(room).emit('message:new', toMessageDTO(message));
    await bumpReplyCount(threadRootId, message.createdAt);
  }

  io.to(room).emit('agent:status', { agentId: agent.id, channelId: channel.id, threadId, state: 'thinking' });

  const started = Date.now();
  let firstTokenAt: number | null = null;
  let content = '';
  let pending = '';
  let usage: { promptTokens: number; completionTokens: number } | undefined;
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = () => {
    flushTimer = null;
    if (!pending) return;
    io.to(room).emit('message:delta', { messageId: message.id, channelId: channel.id, threadId, delta: pending });
    pending = '';
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AGENT_TIMEOUT_MS);

  try {
    const [workspace, channelAgents] = await Promise.all([
      WorkspaceModel.findById(channel.workspaceId),
      AgentModel.find({ _id: { $in: channel.agentIds } }, { name: 1, handle: 1 }),
    ]);
    const humans = workspace ? await UserModel.find({ _id: { $in: workspace.memberIds } }, { name: 1 }) : [];

    const { messages, historyCount } = await buildContext({
      agent,
      channel,
      threadRootId,
      excludeMessageId: message._id,
      participants: { humans: humans.map((h) => h.name), agents: channelAgents.map((a) => ({ name: a.name, handle: a.handle })) },
    });
    log.info('Agent run started', { ...logCtx, messageId: message.id, triggerMessageId: triggerMessageId.toString(), historyCount });

    for await (const chunk of streamChat({
      model: agent.model,
      messages,
      temperature: agent.temperature ?? 0.7,
      signal: controller.signal,
      logContext: { agent: agent.handle, messageId: message.id },
    })) {
      if (chunk.delta) {
        if (firstTokenAt === null) {
          firstTokenAt = Date.now();
          log.debug('First token received', { ...logCtx, firstTokenMs: firstTokenAt - started });
        }
        content += chunk.delta;
        pending += chunk.delta;
        flushTimer ??= setTimeout(flush, DELTA_FLUSH_MS);
      }
      if (chunk.usage) usage = chunk.usage;
    }
    if (flushTimer) clearTimeout(flushTimer);
    flush();

    if (!content.trim()) {
      throw new OpenRouterError('Empty completion', null, 'The model returned an empty response. Try again or switch models.', true);
    }

    const latencyMs = Date.now() - started;
    message.content = content;
    message.status = 'complete';
    message.usage = { ...usage, latencyMs, model: agent.model };
    await message.save();
    io.to(room).emit('message:complete', toMessageDTO(message));

    log.info('Agent run completed', {
      ...logCtx,
      messageId: message.id,
      latencyMs,
      firstTokenMs: firstTokenAt ? firstTokenAt - started : null,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      chars: content.length,
    });
  } catch (err) {
    if (flushTimer) clearTimeout(flushTimer);
    flush();
    const userMessage = err instanceof OpenRouterError ? err.userMessage : 'Something went wrong while generating a reply.';
    log.error('Agent run failed', {
      ...logCtx,
      messageId: message.id,
      latencyMs: Date.now() - started,
      status: err instanceof OpenRouterError ? err.status : undefined,
      error: (err as Error).message,
      stack: err instanceof OpenRouterError ? undefined : (err as Error).stack,
    });
    message.content = content;
    message.status = 'error';
    message.error = userMessage;
    await message.save().catch((saveErr) => log.error('Failed to persist agent error state', { saveErr, messageId: message.id }));
    io.to(room).emit('message:error', toMessageDTO(message));
  } finally {
    clearTimeout(timeout);
    io.to(room).emit('agent:status', { agentId: agent.id, channelId: channel.id, threadId, state: 'idle' });
  }
}

/** Messages left in `streaming` state by a crash/restart can never complete; mark them failed on boot. */
export async function recoverInterruptedRuns() {
  const result = await MessageModel.updateMany(
    { status: 'streaming' },
    { $set: { status: 'error', error: 'Interrupted by a server restart. Retry to regenerate.' } },
  );
  if (result.modifiedCount) log.warn('Marked interrupted agent messages as failed', { count: result.modifiedCount });
}
