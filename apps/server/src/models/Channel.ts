import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const channelSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    agentIds: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

channelSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export type Channel = InferSchemaType<typeof channelSchema>;
export type ChannelDoc = HydratedDocument<Channel>;
export const ChannelModel = model('Channel', channelSchema);
