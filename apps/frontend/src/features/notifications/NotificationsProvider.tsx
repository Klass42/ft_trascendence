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
import { apiClient, useAuth } from '@/lib/api';
import type { NotificationDTO, NotificationsListDTO } from '@/lib/api';
import { useNotificationsSocket } from './useNotificationsSocket';
import { NotificationToasts } from './NotificationToasts';

interface NotificationsContextValue {
  /** Newest notifications (first page): feeds the bell and live arrivals. */
  items: NotificationDTO[];
  /** Total unread count from the server, not just the loaded page. */
  unread: number;
  isLoading: boolean;
  error: Error | null;
  /** Live socket status (badge/UX hint; the app works without it). */
  connected: boolean;
  analyticsUpdate: { courseId: string; receivedAt: number } | null;
  /** Set when a FRIEND_REQUEST notification arrives (new request or accepted one). */
  friendsUpdate: { receivedAt: number } | null;
  refetch: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** How many notifications the center loads up front. */
const PAGE_SIZE = 50;
/** How long a toast stays on screen (ms). */
const TOAST_TTL = 6000;

/**
 * Shared notification state for the whole authenticated shell: the initial list
 * (GET /notifications from Epic A), the unread badge, mark-read mutations, and
 * the live socket feed. Mount it once inside the layout so the navbar bell and
 * the NotificationsPage read the same source of truth.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const [toasts, setToasts] = useState<NotificationDTO[]>([]);
  const [analyticsUpdate, setAnalyticsUpdate] = useState<{
    courseId: string;
    receivedAt: number;
  } | null>(null);
  const [friendsUpdate, setFriendsUpdate] = useState<{ receivedAt: number } | null>(null);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  // Latest list for handlers that must decide before touching state.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // ── Initial + on-demand load ────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<NotificationsListDTO>(`/notifications?page=1&pageSize=${PAGE_SIZE}`)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setUnread(res.unread);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  // ── Live feed ───────────────────────────────────────────────────────────
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleIncoming = useCallback(
    (notification: NotificationDTO) => {
      // Prepend, de-duping by id (a reconnect could replay an event).
      if (itemsRef.current.some((n) => n.id === notification.id)) return;
      setItems((prev) =>
        prev.some((n) => n.id === notification.id)
          ? prev
          : [notification, ...prev],
      );
      if (notification.type === 'FRIEND_REQUEST') setFriendsUpdate({ receivedAt: Date.now() });
      if (!notification.read) setUnread((count) => count + 1);
      setToasts((prev) => [notification, ...prev].slice(0, 4));
      window.setTimeout(() => dismissToast(notification.id), TOAST_TTL);
    },
    [dismissToast],
  );

  const handleAnalyticsUpdate = useCallback(({ courseId }: { courseId: string }) => {
    setAnalyticsUpdate({ courseId, receivedAt: Date.now() });
  }, []);

  const { connected } = useNotificationsSocket({
    userId: user?.userId ?? null,
    onNotification: handleIncoming,
    onAnalyticsUpdate: handleAnalyticsUpdate,
  });

  // ── Mutations (optimistic; reconcile with the server on failure) ─────────
  const failedRef = useRef(false);

  const markRead = useCallback(
    (id: string) => {
      // Callers only mark unread rows; the row may live beyond the loaded page.
      if (!itemsRef.current.find((n) => n.id === id)?.read) {
        setUnread((count) => Math.max(0, count - 1));
      }
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      apiClient
        .patch(`/notifications/${id}/read`)
        .catch(() => {
          failedRef.current = true;
          refetch();
        });
    },
    [refetch],
  );

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    apiClient.post('/notifications/read-all').catch(() => refetch());
  }, [refetch]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unread,
      isLoading,
      error,
      connected,
      analyticsUpdate,
      friendsUpdate,
      refetch,
      markRead,
      markAllRead,
    }),
    [items, unread, isLoading, error, connected, analyticsUpdate, friendsUpdate, refetch, markRead, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationToasts toasts={toasts} onDismiss={dismissToast} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}
