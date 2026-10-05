import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { updateChannelAgentsSchema, type UpdateChannelAgentsInput } from '@slack/shared';
import { badRequest } from '../lib/errors.js';
import { getIO, workspaceRoom } from '../lib/io.js';
import { createLogger } from '../lib/logger.js';
import { toChannelDTO, toMessageDTO } from '../lib/serializers.js';
import { validateBody } from '../middleware/validate.js';
import { AgentModel } from '../models/Agent.js';
import { MessageModel } from '../models/Message.js';
import { loadChannelForUser } from '../services/messageService.js';

const log = createLogger('channels');
const router = Router();

const PAGE_SIZE = 50;

router.patch('/:channelId/agents', validateBody(updateChannelAgentsSchema), async (req, res) => {
  const channel = await loadChannelForUser(String(req.params.channelId), req.user!.id);
  const { agentIds } = req.body as UpdateChannelAgentsInput;
  const agents = await AgentModel.find({ _id: { $in: agentIds.filter(isValidObjectId) }, workspaceId: channel.workspaceId }, { _id: 1 });
  channel.agentIds = agents.map((a) => a._id);
  await channel.save();
  const dto = toChannelDTO(channel);
  getIO().to(workspaceRoom(channel.workspaceId.toString())).emit('channel:upserted', dto);
  log.info('Channel agents updated', { channelId: channel.id, agentCount: agents.length });
  res.json({ channel: dto });
});

/** Top-level channel messages, newest page first; `before` is an ISO timestamp cursor. */
router.get('/:channelId/messages', async (req, res) => {
  const channel = await loadChannelForUser(String(req.params.channelId), req.user!.id);
  const before = typeof req.query.before === 'string' ? new Date(req.query.before) : null;
  if (before && Number.isNaN(before.getTime())) throw badRequest('Invalid cursor');
  const limit = Math.min(Number(req.query.limit) || PAGE_SIZE, 100);

  const docs = await MessageModel.find({
    channelId: channel._id,
    threadId: null,
    ...(before ? { createdAt: { $lt: before } } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit).reverse().map(toMessageDTO);
  res.json({ items, hasMore });
});

export default router;
