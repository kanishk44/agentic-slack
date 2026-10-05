import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    inviteCode: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export type Workspace = InferSchemaType<typeof workspaceSchema>;
export type WorkspaceDoc = HydratedDocument<Workspace>;
export const WorkspaceModel = model('Workspace', workspaceSchema);
