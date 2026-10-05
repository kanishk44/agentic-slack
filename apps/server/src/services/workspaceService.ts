import { customAlphabet } from 'nanoid';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { AgentModel } from '../models/Agent.js';
import { ChannelModel } from '../models/Channel.js';
import { MessageModel } from '../models/Message.js';
import { WorkspaceModel, type WorkspaceDoc } from '../models/Workspace.js';
import { UserModel } from '../models/User.js';
import { toWorkspaceDTO } from '../lib/serializers.js';
import { DEFAULT_AGENTS } from './defaultAgents.js';

const log = createLogger('workspace');

const inviteCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

/** Creates a workspace pre-populated with the default agents and #general / #random channels. */
export async function createWorkspace(name: string, ownerId: string | Types.ObjectId): Promise<WorkspaceDoc> {
  const workspace = await WorkspaceModel.create({
    name,
    ownerId,
    memberIds: [ownerId],
    inviteCode: inviteCode(),
  });

  const agents = await AgentModel.insertMany(
    DEFAULT_AGENTS.map((a) => ({
      ...a,
      model: env.OPENROUTER_DEFAULT_MODEL,
      workspaceId: workspace._id,
      isBuiltIn: true,
    })),
  );
  const agentIds = agents.map((a) => a._id);

  const general = await ChannelModel.create({
    workspaceId: workspace._id,
    name: 'general',
    description: 'Company-wide chat. Every agent is here — @mention one to get started.',
    agentIds,
    createdBy: ownerId,
  });
  await ChannelModel.create({
    workspaceId: workspace._id,
    name: 'random',
    description: 'Off-topic and experiments.',
    agentIds: [],
    createdBy: ownerId,
  });

  const handles = DEFAULT_AGENTS.map((a) => `@${a.handle}`).join(', ');
  await MessageModel.create({
    workspaceId: workspace._id,
    channelId: general._id,
    author: { kind: 'system', id: null, name: 'Agentic Slack', avatar: '⚡' },
    content: `Welcome to **${name}**! This workspace comes with AI teammates: ${handles}.\n\nMention one in a message — e.g. \`@frontend build a responsive navbar\` — and it will reply in a thread.`,
  });

  log.info('Workspace created and seeded', {
    workspaceId: workspace.id,
    ownerId: ownerId.toString(),
    agents: agents.length,
  });
  return workspace;
}

export async function workspaceWithMembers(workspace: WorkspaceDoc) {
  const members = await UserModel.find({ _id: { $in: workspace.memberIds } });
  return toWorkspaceDTO(workspace, members);
}
