import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { MyGradesDTO } from '../types';

interface UseMyGradesResult {
  data: MyGradesDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * The acting student's grades for a course: one row per published activity
 * plus the course `final`. Backend: GET /courses/:id/grades/me (any member).
 * Empty books return 200 `{ items: [], final: null }`.
 */
export function useMyGrades(courseId: string | null): UseMyGradesResult {
  const [data, setData] = useState<MyGradesDTO | null>(null);
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
      .get<MyGradesDTO>(`/subjects/${courseId}/grades/me`)
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
