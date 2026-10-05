import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const authorSchema = new Schema(
  {
    kind: { type: String, enum: ['user', 'agent', 'system'], required: true },
    id: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    avatar: { type: String, required: true },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    /** Parent message id when this is a thread reply; null for top-level messages. */
    threadId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    // Name/avatar are denormalized so history renders without joins.
    author: { type: authorSchema, required: true },
    content: { type: String, default: '' },
    mentions: [
      {
        _id: false,
        kind: { type: String, enum: ['user', 'agent'], required: true },
        id: { type: Schema.Types.ObjectId, required: true },
      },
    ],
    status: { type: String, enum: ['complete', 'streaming', 'error'], default: 'complete' },
    error: { type: String },
    usage: {
      promptTokens: Number,
      completionTokens: Number,
      latencyMs: Number,
      model: String,
    },
    replyCount: { type: Number, default: 0 },
    lastReplyAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ channelId: 1, threadId: 1, createdAt: -1 });

export type Message = InferSchemaType<typeof messageSchema>;
export type MessageDoc = HydratedDocument<Message>;
export const MessageModel = model('Message', messageSchema);
