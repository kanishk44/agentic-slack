import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const agentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true },
    handle: { type: String, required: true, lowercase: true, trim: true },
    avatar: { type: String, default: '🤖' },
    description: { type: String, default: '' },
    systemPrompt: { type: String, required: true },
    model: { type: String, required: true },
    temperature: { type: Number, default: 0.7 },
    contextWindow: { type: Number, default: 20 },
    isBuiltIn: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

agentSchema.index({ workspaceId: 1, handle: 1 }, { unique: true });

export type Agent = InferSchemaType<typeof agentSchema>;
export type AgentDoc = HydratedDocument<Agent>;
export const AgentModel = model('Agent', agentSchema);
