import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('db');

const MAX_RETRIES = 5;

function safeUri(uri: string) {
  return uri.replace(/\/\/([^@]+)@/, '//***@');
}

export async function connectDb(): Promise<void> {
  mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => log.error('MongoDB connection error', { err }));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
      log.info('MongoDB connected', { uri: safeUri(env.MONGO_URI) });
      return;
    } catch (err) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10_000);
      log.error('MongoDB connection failed', { attempt, maxRetries: MAX_RETRIES, retryInMs: delay, error: (err as Error).message });
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  log.info('MongoDB connection closed');
}
