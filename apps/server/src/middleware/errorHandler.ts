import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { HttpError } from '../lib/errors.js';
import { OpenRouterError } from '../services/openrouter.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('error');

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    if (err.status >= 500) log.error(err.message, { err, path: req.path });
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof OpenRouterError) {
    log.warn('Upstream model provider error', { status: err.status, error: err.message, path: req.path });
    res.status(502).json({ error: err.userMessage });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: `Invalid ${err.path}` });
    return;
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? {}).pop() ?? 'value';
    res.status(409).json({ error: `That ${field} is already taken` });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  log.error('Unhandled request error', { err, method: req.method, path: req.originalUrl });
  res.status(500).json({ error: 'Internal server error' });
};
