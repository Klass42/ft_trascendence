import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { SubmissionDTO } from '../types';

interface UseAssignmentSubmissionsResult {
  data: SubmissionDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * All submissions for an assignment — teacher/assistant view. The backend
 * returns 403 for students, so callers should only mount this for staff.
 */
export function useAssignmentSubmissions(
  assignmentId: string | null,
  enabled = true,
): UseAssignmentSubmissionsResult {
  const [data, setData] = useState<SubmissionDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!assignmentId || !user || !enabled) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<SubmissionDTO[]>(`/assignments/${assignmentId}/submissions`)
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
  }, [assignmentId, user, enabled, nonce]);

  return { data, isLoading, error, refetch };
}
