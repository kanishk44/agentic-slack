import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { requestContext } from '../lib/requestContext.js';

/** Assigns a request id (honoring an incoming X-Request-Id) and opens an AsyncLocalStorage scope for logs. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 64 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  requestContext.run({ requestId: id }, next);
};
