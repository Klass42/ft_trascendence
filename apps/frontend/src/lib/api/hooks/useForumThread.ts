import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { ForumThreadDTO } from '../types';

interface UseForumThreadResult {
  data: ForumThreadDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Load a single thread with its posts nested into a reply tree. The backend
 * derives the tenant from the thread's course and rejects non-members.
 */
export function useForumThread(threadId: string | null): UseForumThreadResult {
  const [data, setData] = useState<ForumThreadDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!threadId || !user) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<ForumThreadDTO>(`/threads/${threadId}`)
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
  }, [threadId, user, nonce]);

  return { data, isLoading, error, refetch };
}
