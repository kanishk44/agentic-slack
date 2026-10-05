import path from 'node:path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env, isProd } from '../config/env.js';
import { getRequestContext } from './requestContext.js';

const SENSITIVE_KEYS = new Set(['password', 'passwordhash', 'authorization', 'cookie', 'token', 'apikey', 'api_key', 'jwt']);

function serializeError(err: Error): Record<string, unknown> {
  const extra = Object.fromEntries(Object.entries(err));
  return { name: err.name, message: err.message, stack: err.stack, ...extra };
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  // Error props are non-enumerable and would serialize as `{}`.
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

/** Strips secrets from metadata and attaches requestId/userId from AsyncLocalStorage. */
const contextAndRedact = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    info.requestId ??= ctx.requestId;
    if (ctx.userId) info.userId ??= ctx.userId;
  }
  for (const key of Object.keys(info)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) info[key] = '[REDACTED]';
    else if (key !== 'level' && key !== 'message') info[key] = redact(info[key]);
  }
  return info;
});

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  contextAndRedact(),
  winston.format.json(),
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  contextAndRedact(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, module, stack, ...meta }) => {
    const mod = module ? `[${module}] ` : '';
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${mod}${message}${rest}${stack ? `\n${stack}` : ''}`;
  }),
);

const logDir = path.resolve(process.cwd(), env.LOG_DIR);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'agentic-slack' },
  transports: [
    new winston.transports.Console({ format: isProd ? jsonFormat : prettyFormat }),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      format: jsonFormat,
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      level: 'error',
      format: jsonFormat,
    }),
  ],
  exitOnError: false,
});

/** Module-scoped child logger, e.g. `createLogger('agentRunner')`. */
export const createLogger = (module: string) => logger.child({ module });
