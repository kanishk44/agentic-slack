import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/agentic-slack'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_DIR: z.string().default('logs'),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: z.string().default('openrouter/free'),
  AGENT_CONCURRENCY: z.coerce.number().int().positive().default(4),
  AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Logger isn't available yet (it depends on env), so print directly and exit.
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
