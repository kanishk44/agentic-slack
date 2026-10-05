import type { RequestHandler } from 'express';
import { AUTH_COOKIE, verifyToken } from '../lib/auth.js';
import { unauthorized } from '../lib/errors.js';
import { getRequestContext } from '../lib/requestContext.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload) return next(unauthorized());
  req.user = { id: payload.sub, name: payload.name };
  const ctx = getRequestContext();
  if (ctx) ctx.userId = payload.sub;
  next();
};
