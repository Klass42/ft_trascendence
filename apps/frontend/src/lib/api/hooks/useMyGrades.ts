import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { MyGradeDTO } from '../types';

interface UseMyGradesResult {
  data: MyGradeDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * The acting student's grades for a course: one row per assignment with their
 * score/status/feedback. Backend endpoint: GET /courses/:id/grades/me (any
 * course member).
 */
export function useMyGrades(courseId: string | null): UseMyGradesResult {
  const [data, setData] = useState<MyGradeDTO[] | null>(null);
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
      .get<MyGradeDTO[]>(`/courses/${courseId}/grades/me`)
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
