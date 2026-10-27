import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, useAuth } from '@/lib/api';
import type { NotificationDTO, NotificationsListDTO } from '@/lib/api';

export type NotificationFilter = 'all' | 'unread';

/** Notifications fetched per request; mirrors the backend's `pageSize` bound (1–100). */
export const FEED_PAGE_SIZE = 20;

/**
 * Paginated, server-filtered list for the notifications page
 * (`GET /notifications?page&pageSize&unreadOnly`). Independent from the
 * provider's first page, which only feeds the bell and live arrivals.
 */
export function useNotificationsFeed(filter: NotificationFilter) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loadingMoreRef = useRef(false);

  const path = useCallback(
    (target: number) =>
      `/notifications?page=${target}&pageSize=${FEED_PAGE_SIZE}${filter === 'unread' ? '&unreadOnly=true' : ''}`,
    [filter],
  );

  useEffect(() => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setLoadMoreFailed(false);
    setItems([]);
    setPage(0);
    apiClient
      .get<NotificationsListDTO>(path(1))
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setPage(1);
        setTotal(res.total);
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
  }, [user, path, nonce]);

  const hasMore = page > 0 && page * FEED_PAGE_SIZE < total;

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const res = await apiClient.get<NotificationsListDTO>(path(page + 1));
      // New notifications shift the offset, so a row can come back twice.
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...res.items.filter((n) => !seen.has(n.id))];
      });
      setPage(page + 1);
      setTotal(res.total);
    } catch {
      setLoadMoreFailed(true);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, page, path]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  /** Mirror a read action locally (the provider owns the request). */
  const markReadLocal = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);
  const markAllReadLocal = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return {
    items,
    isLoading,
    isLoadingMore,
    error,
    loadMoreFailed,
    hasMore,
    loadMore,
    retry,
    markReadLocal,
    markAllReadLocal,
  };
}
