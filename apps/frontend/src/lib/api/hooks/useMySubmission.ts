import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { SubmissionDTO } from '../types';

interface UseMySubmissionResult {
  data: SubmissionDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * The acting user's own submission for an assignment (or null if they haven't
 * submitted yet). Backend endpoint: GET /assignments/:id/submissions/me.
 */
export function useMySubmission(
  assignmentId: string | null,
): UseMySubmissionResult {
  const [data, setData] = useState<SubmissionDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!assignmentId || !user) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<SubmissionDTO | null>(`/assignments/${assignmentId}/submissions/me`)
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
  }, [assignmentId, user, nonce]);

  return { data, isLoading, error, refetch };
}
