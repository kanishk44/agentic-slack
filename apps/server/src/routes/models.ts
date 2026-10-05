import { Router } from 'express';
import { env } from '../config/env.js';
import { listFreeModels } from '../services/openrouter.js';

const router = Router();

router.get('/', async (_req, res) => {
  const models = await listFreeModels();
  res.json({ models, defaultModel: env.OPENROUTER_DEFAULT_MODEL });
});

export default router;
