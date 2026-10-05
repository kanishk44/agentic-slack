import http from 'node:http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { createApp } from './app.js';
import { initSocket } from './socket/index.js';
import { recoverInterruptedRuns } from './services/agentRunner.js';

const log = logger.child({ module: 'server' });

process.on('unhandledRejection', (reason) => log.error('Unhandled promise rejection', { reason }));
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception — shutting down', { err });
  process.exit(1);
});

async function main() {
  log.info('Starting server', { env: env.NODE_ENV, port: env.PORT, defaultModel: env.OPENROUTER_DEFAULT_MODEL });
  if (!env.OPENROUTER_API_KEY) log.warn('OPENROUTER_API_KEY is not set — agents will reply with an error until it is configured');

  await connectDb();
  await recoverInterruptedRuns();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);

  server.listen(env.PORT, () => log.info(`API listening on http://localhost:${env.PORT}`, { clientOrigin: env.CLIENT_ORIGIN }));

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('Shutdown signal received', { signal });
    const force = setTimeout(() => {
      log.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
    force.unref();
    io.close();
    server.close();
    await disconnectDb().catch((err) => log.error('Error closing DB', { err }));
    log.info('Shutdown complete');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error('Fatal startup error', { err });
  process.exit(1);
});
