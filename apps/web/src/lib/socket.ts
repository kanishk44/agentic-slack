import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@slack/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** Lazily creates the shared socket. Same-origin (via the Vite proxy) so the auth cookie is sent. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({ withCredentials: true, autoConnect: false, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
