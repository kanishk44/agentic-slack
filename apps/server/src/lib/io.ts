import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@slack/shared';

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface SocketData {
  userId: string;
  name: string;
}

let io: IO | null = null;

export const setIO = (instance: IO) => {
  io = instance;
};

export const getIO = (): IO => {
  if (!io) throw new Error('Socket.IO server not initialized');
  return io;
};

export const channelRoom = (channelId: string) => `channel:${channelId}`;
export const workspaceRoom = (workspaceId: string) => `workspace:${workspaceId}`;
