import type { RequestHandler } from 'express';
import { createLogger } from '../lib/logger.js';

const log = createLogger('http');

export const httpLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: req.user?.id,
      requestId: req.requestId,
    };
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    log.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
  });
  next();
};
