import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { notFound } from '../lib/errors.js';
import { toMessageDTO } from '../lib/serializers.js';
import { MessageModel } from '../models/Message.js';
import { loadChannelForUser, retryAgentMessage } from '../services/messageService.js';

const router = Router();

/** A thread: the root message plus all replies in order. */
router.get('/:messageId/thread', async (req, res) => {
  const messageId = String(req.params.messageId);
  if (!isValidObjectId(messageId)) throw notFound('Thread not found');
  const root = await MessageModel.findById(messageId);
  if (!root || root.threadId) throw notFound('Thread not found');
  await loadChannelForUser(root.channelId.toString(), req.user!.id);
  const replies = await MessageModel.find({ threadId: root._id }).sort({ createdAt: 1 }).limit(500);
  res.json({ root: toMessageDTO(root), replies: replies.map(toMessageDTO) });
});

router.post('/:messageId/retry', async (req, res) => {
  await retryAgentMessage(req.user!.id, String(req.params.messageId));
  res.status(202).json({ ok: true });
});

export default router;
