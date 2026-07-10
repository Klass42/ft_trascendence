import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { ForumThreadListItemDTO } from '../types';

interface UseForumThreadsResult {
  data: ForumThreadListItemDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * List a course's forum threads (pinned first, then newest). When `search` is a
 * non-empty string it hits the forum search endpoint instead. Identity — and
 * therefore the tenant — is derived server-side from the x-dev-user header, so
 * no organizationId is passed here; the backend scopes via the course.
 */
export function useForumThreads(
  courseId: string | null,
  search = '',
): UseForumThreadsResult {
  const [data, setData] = useState<ForumThreadListItemDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  const q = search.trim();

  useEffect(() => {
    if (!courseId || !user) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const path = q
      ? `/courses/${courseId}/forum/search?q=${encodeURIComponent(q)}`
      : `/courses/${courseId}/forum/threads`;

    apiClient
      .get<ForumThreadListItemDTO[]>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err as Error);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, user, q, nonce]);

  return { data, isLoading, error, refetch };
}
