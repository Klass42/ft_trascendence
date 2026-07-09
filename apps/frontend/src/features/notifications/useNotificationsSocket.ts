import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { NotificationDTO } from '@/lib/api';

interface UseNotificationsSocketOptions {
  /** Acting user id (from `useAuth`). Null keeps the socket disconnected. */
  userId: string | null;
  /** Invoked for every `notification:new` pushed by the backend. */
  onNotification: (notification: NotificationDTO) => void;
}

/**
 * Opens a Socket.io connection scoped to `userId` and calls `onNotification`
 * for each `notification:new` the realtime gateway pushes. Reconnection (with
 * exponential backoff) is handled by socket.io itself — when the backend drops
 * or restarts, the client re-dials automatically and re-joins its user room on
 * the fresh handshake; we only surface `connected` for optional UI.
 *
 * The connection is same-origin in dev (Vite proxies `/socket.io` → :3000), so
 * no CORS is involved. Identity travels in the handshake as `auth.userId`.
 * TODO(auth): enviar el JWT real (Jorge) en `auth.token` en lugar de auth.userId.
 */
export function useNotificationsSocket({
  userId,
  onNotification,
}: UseNotificationsSocketOptions): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  // Keep the latest callback without forcing a reconnect when it changes.
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;

  useEffect(() => {
    if (!userId) {
      setConnected(false);
      return;
    }

    // No URL → same origin. `auth.userId` reaches handshake.auth.userId server-side.
    const socket = io({
      auth: { userId },
      // Graceful reconnection (these are the socket.io defaults, made explicit).
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleNew = (notification: NotificationDTO) =>
      handlerRef.current(notification);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('notification:new', handleNew);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('notification:new', handleNew);
      socket.disconnect();
    };
  }, [userId]);

  return { connected };
}
