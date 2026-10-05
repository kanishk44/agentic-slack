import { Router } from 'express';
import {
  createAgentSchema,
  createChannelSchema,
  createWorkspaceSchema,
  joinWorkspaceSchema,
  type CreateWorkspaceInput,
  type JoinWorkspaceInput,
} from '@slack/shared';
import type { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { getIO, workspaceRoom } from '../lib/io.js';
import { createLogger } from '../lib/logger.js';
import { toAgentDTO, toChannelDTO } from '../lib/serializers.js';
import { validateBody } from '../middleware/validate.js';
import { requireWorkspaceMember } from '../middleware/workspaceMember.js';
import { AgentModel } from '../models/Agent.js';
import { ChannelModel } from '../models/Channel.js';
import { WorkspaceModel } from '../models/Workspace.js';
import { createWorkspace, workspaceWithMembers } from '../services/workspaceService.js';
import { joinUserSocketsToRoom } from '../socket/index.js';

const log = createLogger('workspaces');
const router = Router();

router.get('/', async (req, res) => {
  const workspaces = await WorkspaceModel.find({ memberIds: req.user!.id }).sort({ createdAt: 1 });
  res.json({ workspaces: await Promise.all(workspaces.map(workspaceWithMembers)) });
});

router.post('/', validateBody(createWorkspaceSchema), async (req, res) => {
  const { name } = req.body as CreateWorkspaceInput;
  const workspace = await createWorkspace(name, req.user!.id);
  joinUserSocketsToRoom(req.user!.id, workspaceRoom(workspace.id));
  res.status(201).json({ workspace: await workspaceWithMembers(workspace) });
});

router.post('/join', validateBody(joinWorkspaceSchema), async (req, res) => {
  const { inviteCode } = req.body as JoinWorkspaceInput;
  const workspace = await WorkspaceModel.findOneAndUpdate(
    { inviteCode: inviteCode.toUpperCase() },
    { $addToSet: { memberIds: req.user!.id } },
    { new: true },
  );
  if (!workspace) {
    log.warn('Join with invalid invite code', { userId: req.user!.id });
    throw notFound('No workspace found for that invite code');
  }
  joinUserSocketsToRoom(req.user!.id, workspaceRoom(workspace.id));
  const dto = await workspaceWithMembers(workspace);
  getIO().to(workspaceRoom(workspace.id)).emit('workspace:upserted', dto);
  log.info('User joined workspace', { workspaceId: workspace.id, userId: req.user!.id, members: dto.members.length });
  res.json({ workspace: dto });
});

router.get('/:workspaceId/channels', requireWorkspaceMember, async (req, res) => {
  const channels = await ChannelModel.find({ workspaceId: req.workspace!._id }).sort({ name: 1 });
  res.json({ channels: channels.map(toChannelDTO) });
});

router.post('/:workspaceId/channels', requireWorkspaceMember, validateBody(createChannelSchema), async (req, res) => {
  const input = req.body as z.output<typeof createChannelSchema>;
  const validAgents = await AgentModel.find({ _id: { $in: input.agentIds }, workspaceId: req.workspace!._id }, { _id: 1 });
  const channel = await ChannelModel.create({
    workspaceId: req.workspace!._id,
    name: input.name,
    description: input.description,
    agentIds: validAgents.map((a) => a._id),
    createdBy: req.user!.id,
  });
  const dto = toChannelDTO(channel);
  getIO().to(workspaceRoom(req.workspace!.id)).emit('channel:upserted', dto);
  log.info('Channel created', { channelId: channel.id, workspaceId: req.workspace!.id, name: channel.name });
  res.status(201).json({ channel: dto });
});

router.get('/:workspaceId/agents', requireWorkspaceMember, async (req, res) => {
  const agents = await AgentModel.find({ workspaceId: req.workspace!._id }).sort({ isBuiltIn: -1, name: 1 });
  res.json({ agents: agents.map(toAgentDTO) });
});

router.post('/:workspaceId/agents', requireWorkspaceMember, validateBody(createAgentSchema), async (req, res) => {
  const input = req.body as z.output<typeof createAgentSchema>;
  const agent = await AgentModel.create({ ...input, workspaceId: req.workspace!._id, createdBy: req.user!.id, isBuiltIn: false });
  const dto = toAgentDTO(agent);
  getIO().to(workspaceRoom(req.workspace!.id)).emit('agent:upserted', dto);
  log.info('Agent created', { agentId: agent.id, handle: agent.handle, model: agent.model, workspaceId: req.workspace!.id });
  res.status(201).json({ agent: dto });
});

export default router;
