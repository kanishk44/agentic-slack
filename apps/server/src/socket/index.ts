import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { sendMessageSchema } from '@slack/shared';
import { env } from '../config/env.js';
import { AUTH_COOKIE, verifyToken } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { channelRoom, getIO, setIO, workspaceRoom, type IO } from '../lib/io.js';
import { createLogger } from '../lib/logger.js';
import { requestContext } from '../lib/requestContext.js';
import { WorkspaceModel } from '../models/Workspace.js';
import { loadChannelForUser, sendUserMessage } from '../services/messageService.js';

const log = createLogger('socket');

const userRoom = (userId: string) => `user:${userId}`;

/** Simple per-socket sliding window limiter for message sends. */
function createLimiter(max: number, windowMs: number) {
  const hits: number[] = [];
  return () => {
    const now = Date.now();
    while (hits.length && now - hits[0] > windowMs) hits.shift();
    if (hits.length >= max) return false;
    hits.push(now);
    return true;
  };
}

const errorMessage = (err: unknown) => (err instanceof HttpError ? err.message : 'Something went wrong');

export function initSocket(server: HttpServer): IO {
  const io: IO = new Server(server, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });
  setIO(io);

  io.use((socket, next) => {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
    const token = cookies[AUTH_COOKIE];
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      log.warn('Socket auth rejected', { ip: socket.handshake.address });
      return next(new Error('unauthorized'));
    }
    socket.data.userId = payload.sub;
    socket.data.name = payload.name;
    next();
  });

  io.on('connection', (socket) => {
    const { userId, name } = socket.data;
    const withContext = <T>(fn: () => T) => requestContext.run({ requestId: randomUUID(), userId }, fn);
    const allowSend = createLimiter(10, 10_000);

    // Handlers below must be registered synchronously, or events sent right after connect are dropped.
    socket.join(userRoom(userId));
    WorkspaceModel.find({ memberIds: userId }, { _id: 1 })
      .then((workspaces) => {
        socket.join(workspaces.map((w) => workspaceRoom(w.id)));
        log.info('Socket connected', { socketId: socket.id, userId, workspaces: workspaces.length });
      })
      .catch((err) => log.error('Failed to join workspace rooms', { err, userId }));

    socket.on('channel:join', (channelId, ack) =>
      withContext(async () => {
        try {
          await loadChannelForUser(channelId, userId);
          await socket.join(channelRoom(channelId));
          log.debug('Socket joined channel', { socketId: socket.id, channelId });
          ack?.({ ok: true, data: null });
        } catch (err) {
          log.warn('Channel join rejected', { channelId, error: (err as Error).message });
          ack?.({ ok: false, error: errorMessage(err) });
        }
      }),
    );

    socket.on('channel:leave', (channelId) => {
      void socket.leave(channelRoom(channelId));
    });

    socket.on('message:send', (input, ack) =>
      withContext(async () => {
        if (typeof ack !== 'function') return;
        if (!allowSend()) {
          log.warn('Message rate limit hit', { socketId: socket.id });
          return ack({ ok: false, error: "You're sending messages too fast. Slow down a little." });
        }
        const parsed = sendMessageSchema.safeParse(input);
        if (!parsed.success) return ack({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid message' });
        try {
          ack({ ok: true, data: await sendUserMessage(userId, parsed.data) });
        } catch (err) {
          if (!(err instanceof HttpError)) log.error('message:send failed', { err });
          ack({ ok: false, error: errorMessage(err) });
        }
      }),
    );

    socket.on('typing', (channelId) => {
      if (typeof channelId !== 'string' || !socket.rooms.has(channelRoom(channelId))) return;
      socket.to(channelRoom(channelId)).emit('typing', { channelId, userId, name });
    });

    socket.on('disconnect', (reason) => {
      log.info('Socket disconnected', { socketId: socket.id, userId, reason });
    });
  });

  return io;
}

/** Adds all of a user's live sockets to a room (e.g. after joining a workspace). */
export function joinUserSocketsToRoom(userId: string, room: string) {
  getIO().in(userRoom(userId)).socketsJoin(room);
}
