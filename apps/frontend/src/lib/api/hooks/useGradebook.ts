import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { GradebookDTO } from '../types';

interface UseGradebookResult {
  data: GradebookDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * The full gradebook (students × assignments) for a course — staff only. The
 * backend returns 403 for non-staff, so mount this only for teachers/assistants.
 * Identity (and tenant) is derived server-side from the injected header.
 */
export function useGradebook(courseId: string | null): UseGradebookResult {
  const [data, setData] = useState<GradebookDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!courseId || !user) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<GradebookDTO>(`/courses/${courseId}/gradebook`)
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
  }, [courseId, user, nonce]);

  return { data, isLoading, error, refetch };
}
