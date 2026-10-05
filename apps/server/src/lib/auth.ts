import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env, isProd } from '../config/env.js';

export const AUTH_COOKIE = 'as_token';

export interface JwtPayload {
  sub: string;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: `${env.JWT_EXPIRES_IN_DAYS}d` });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'object' && typeof decoded.sub === 'string') {
      return { sub: decoded.sub, name: String(decoded.name ?? '') };
    }
    return null;
  } catch {
    return null;
  }
}

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: env.JWT_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
}
