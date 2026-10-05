import rateLimit from 'express-rate-limit';
import { createLogger } from '../lib/logger.js';

const log = createLogger('rateLimit');

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    log.warn('Auth rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(options.statusCode).json({ error: 'Too many attempts, please try again later' });
  },
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
