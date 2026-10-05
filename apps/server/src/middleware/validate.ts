import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors.js';

/** Validates and replaces `req.body` with the parsed (coerced/defaulted) value. */
export const validateBody =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      return next(badRequest(first?.message ?? 'Invalid request body', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
