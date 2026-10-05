import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { updateAgentSchema } from '@slack/shared';
import type { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { getIO, workspaceRoom } from '../lib/io.js';
import { createLogger } from '../lib/logger.js';
import { toAgentDTO, toChannelDTO } from '../lib/serializers.js';
import { validateBody } from '../middleware/validate.js';
import { assertMember } from '../middleware/workspaceMember.js';
import { AgentModel } from '../models/Agent.js';
import { ChannelModel } from '../models/Channel.js';

const log = createLogger('agents');
const router = Router();

async function loadAgent(agentId: string, userId: string) {
  if (!isValidObjectId(agentId)) throw notFound('Agent not found');
  const agent = await AgentModel.findById(agentId);
  if (!agent) throw notFound('Agent not found');
  await assertMember(agent.workspaceId.toString(), userId);
  return agent;
}

router.patch('/:agentId', validateBody(updateAgentSchema), async (req, res) => {
  const agent = await loadAgent(String(req.params.agentId), req.user!.id);
  const input = req.body as z.output<typeof updateAgentSchema>;
  if (agent.isBuiltIn && input.handle && input.handle !== agent.handle) {
    throw badRequest('Built-in agents keep their handle');
  }
  agent.set(input);
  await agent.save();
  const dto = toAgentDTO(agent);
  getIO().to(workspaceRoom(agent.workspaceId.toString())).emit('agent:upserted', dto);
  log.info('Agent updated', { agentId: agent.id, fields: Object.keys(input) });
  res.json({ agent: dto });
});

router.delete('/:agentId', async (req, res) => {
  const agent = await loadAgent(String(req.params.agentId), req.user!.id);
  if (agent.isBuiltIn) throw badRequest('Built-in agents cannot be deleted');
  await agent.deleteOne();

  const channels = await ChannelModel.find({ agentIds: agent._id });
  const io = getIO().to(workspaceRoom(agent.workspaceId.toString()));
  for (const channel of channels) {
    channel.agentIds = channel.agentIds.filter((id) => !id.equals(agent._id));
    await channel.save();
    io.emit('channel:upserted', toChannelDTO(channel));
  }
  io.emit('agent:deleted', { agentId: agent.id, workspaceId: agent.workspaceId.toString() });
  log.info('Agent deleted', { agentId: agent.id, handle: agent.handle, channelsUpdated: channels.length });
  res.status(204).end();
});

export default router;
