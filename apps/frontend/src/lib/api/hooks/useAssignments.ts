import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { AssignmentDTO } from '../types';

interface UseAssignmentsResult {
  data: AssignmentDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * List the assignments of a course. Identity (and therefore the tenant) is
 * derived server-side from the `x-dev-user` header the api client injects, so
 * no organizationId is passed here — the backend scopes via the course.
 */
export function useAssignments(courseId: string | null): UseAssignmentsResult {
  const [data, setData] = useState<AssignmentDTO[] | null>(null);
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
      .get<AssignmentDTO[]>(`/subjects/${courseId}/assignments`)
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
