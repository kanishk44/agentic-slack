import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import { WorkspaceModel } from '../models/Workspace.js';
import { forbidden, notFound } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('access');

/** Loads `:workspaceId` into `req.workspace` and ensures the caller is a member. */
export const requireWorkspaceMember: RequestHandler = async (req, _res, next) => {
  const workspaceId = req.params.workspaceId;
  if (!workspaceId || !isValidObjectId(workspaceId)) return next(notFound('Workspace not found'));
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) return next(notFound('Workspace not found'));
  if (!workspace.memberIds.some((m) => m.toString() === req.user!.id)) {
    log.warn('Workspace access denied', { workspaceId, userId: req.user!.id });
    return next(forbidden('You are not a member of this workspace'));
  }
  req.workspace = workspace;
  next();
};

/** Shared check for resources (channel/agent/message) that belong to a workspace. */
export async function assertMember(workspaceId: string, userId: string) {
  const exists = await WorkspaceModel.exists({ _id: workspaceId, memberIds: userId });
  if (!exists) {
    log.warn('Workspace access denied', { workspaceId, userId });
    throw forbidden('You are not a member of this workspace');
  }
}
