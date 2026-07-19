import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io } from 'socket.io-client';
import { apiClient, useAuth } from '@/lib/api';
import type { PresenceFriendDTO, PresenceUpdate } from './types';

interface PresenceContextValue {
  friends: PresenceFriendDTO[];
  onlineCount: number;
  isLoading: boolean;
  /** Live socket status (the widget still works from the initial fetch). */
  connected: boolean;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

/**
 * Tracks the acting user's friends and their online status in real time (A6b).
 *
 * - Initial paint from `GET /me/presence/friends`.
 * - A Socket.io connection applies `presence:update` events as they arrive, so a
 *   friend going online/offline flips live with no reload.
 * - On every (re)connect we refetch the full list, so a drop/restart resyncs
 *   gracefully (socket.io handles the reconnection/backoff itself).
 *
 * Identity travels in the handshake as `auth.userId` (dev) — same contract as
 * the notifications socket; the gateway also accepts a real JWT in `auth.token`.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<PresenceFriendDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<PresenceFriendDTO[]>(
        '/me/presence/friends',
      );
      setFriends(data);
    } catch {
      // Best-effort widget: a failed load just shows no friends.
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Keep the latest loader for the socket's connect handler without reconnecting.
  const loadRef = useRef(load);
  loadRef.current = load;

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    load();
  }, [user, load]);

  // ── Live socket ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setConnected(false);
      return;
    }

    const socket = io({
      auth: { userId: user.userId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const handleConnect = () => {
      setConnected(true);
      // Resync on connect and every reconnect.
      loadRef.current();
    };
    const handleDisconnect = () => setConnected(false);
    const handlePresence = ({ userId, online }: PresenceUpdate) => {
      setFriends((prev) =>
        prev.map((f) => (f.id === userId ? { ...f, online } : f)),
      );
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('presence:update', handlePresence);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('presence:update', handlePresence);
      socket.disconnect();
    };
  }, [user]);

  const onlineCount = useMemo(
    () => friends.filter((f) => f.online).length,
    [friends],
  );

  const value = useMemo<PresenceContextValue>(
    () => ({ friends, onlineCount, isLoading, connected }),
    [friends, onlineCount, isLoading, connected],
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence(): PresenceContextValue {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return ctx;
}
