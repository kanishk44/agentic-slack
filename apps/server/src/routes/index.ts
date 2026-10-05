import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { apiRateLimit } from '../middleware/rateLimit.js';
import agents from './agents.js';
import auth from './auth.js';
import channels from './channels.js';
import messages from './messages.js';
import models from './models.js';
import workspaces from './workspaces.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down', uptime: process.uptime() });
});

router.use('/auth', auth);
router.use(apiRateLimit, requireAuth);
router.use('/workspaces', workspaces);
router.use('/channels', channels);
router.use('/agents', agents);
router.use('/messages', messages);
router.use('/models', models);

export default router;
