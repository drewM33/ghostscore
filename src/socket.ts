/**
 * Shared Socket.IO instance for emitting events from route handlers.
 * Avoids circular dependency (server -> routes -> server).
 */
import type { Server as SocketIOServer } from 'socket.io';

let _io: SocketIOServer | null = null;

export function setSocketIO(instance: SocketIOServer): void {
  _io = instance;
}

export function getSocketIO(): SocketIOServer | null {
  return _io;
}
