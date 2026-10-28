import type { Socket } from 'socket.io-client';
import { apiClient } from './client';
import { tokenStorage } from './token-storage';

/**
 * Socket.io handshake identity, aligned with the realtime gateway contract.
 *
 * Production connections carry the same access JWT used by the HTTP client.
 * During local development `DevTokenStorage` deliberately has no JWT, so the
 * existing `auth.userId` valve remains available to the non-production gateway.
 *
 * Pass it to socket.io as `auth: (cb) => cb(socketAuth(userId))` so every
 * (re)connect reads the current token instead of the one from the first dial.
 */
export function socketAuth(userId: string): { token: string } | { userId: string } {
  const token = tokenStorage.getAccessToken();
  return token ? { token } : { userId };
}

/** Minimum gap between two refresh-and-reconnect attempts, so a gateway that keeps refusing us cannot cause a loop. */
const SERVER_DISCONNECT_RETRY_MS = 30_000;

/**
 * The gateway refuses a handshake with an expired/invalid JWT by disconnecting
 * the socket, and socket.io does not auto-reconnect after a server-initiated
 * disconnect. Refresh the session once and dial again (the auth callback then
 * sends the fresh token). Call once per socket.
 */
export function retryAfterServerDisconnect(socket: Socket): void {
  let lastAttempt = 0;
  socket.on('disconnect', (reason) => {
    if (reason !== 'io server disconnect') return;
    const now = Date.now();
    if (now - lastAttempt < SERVER_DISCONNECT_RETRY_MS) return;
    lastAttempt = now;
    void apiClient.refreshSession().then((refreshed) => {
      if (refreshed) socket.connect();
    });
  });
}
