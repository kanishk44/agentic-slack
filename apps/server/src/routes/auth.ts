import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@slack/shared';
import { clearAuthCookie, setAuthCookie, signToken } from '../lib/auth.js';
import { conflict, notFound, unauthorized } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { toUserDTO } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { UserModel } from '../models/User.js';
import { createWorkspace } from '../services/workspaceService.js';

const log = createLogger('auth');
const router = Router();

const AVATAR_COLORS = ['#e11d48', '#db2777', '#9333ea', '#4f46e5', '#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#ea580c'];

router.post('/signup', authRateLimit, validateBody(signupSchema), async (req, res) => {
  const { name, email, password } = req.body as SignupInput;
  if (await UserModel.exists({ email })) {
    log.warn('Signup rejected: email already registered', { email });
    throw conflict('An account with this email already exists');
  }
  const user = await UserModel.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  });
  await createWorkspace(`${name.split(' ')[0]}'s Workspace`, user._id);
  setAuthCookie(res, signToken({ sub: user.id, name: user.name }));
  log.info('User signed up', { userId: user.id });
  res.status(201).json({ user: toUserDTO(user) });
});

router.post('/login', authRateLimit, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as LoginInput;
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    log.warn('Login failed', { email, reason: user ? 'bad_password' : 'unknown_email' });
    throw unauthorized('Invalid email or password');
  }
  setAuthCookie(res, signToken({ sub: user.id, name: user.name }));
  log.info('User logged in', { userId: user.id });
  res.json({ user: toUserDTO(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  log.info('User logged out', { userId: req.user?.id });
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw notFound('User not found');
  res.json({ user: toUserDTO(user) });
});

export default router;
