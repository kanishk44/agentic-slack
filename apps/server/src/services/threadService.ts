import type { Types } from 'mongoose';
import { channelRoom, getIO } from '../lib/io.js';
import { toMessageDTO } from '../lib/serializers.js';
import { MessageModel } from '../models/Message.js';

/** Increments a thread root's reply count and broadcasts the updated root. */
export async function bumpReplyCount(threadRootId: Types.ObjectId, at: Date) {
  const root = await MessageModel.findByIdAndUpdate(
    threadRootId,
    { $inc: { replyCount: 1 }, $set: { lastReplyAt: at } },
    { new: true },
  );
  if (root) getIO().to(channelRoom(root.channelId.toString())).emit('message:updated', toMessageDTO(root));
}
