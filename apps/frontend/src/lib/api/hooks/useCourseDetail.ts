import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { SubjectDTO } from '../types';

interface UseCourseDetailResult {
  data: SubjectDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCourseDetail(courseId: string | undefined): UseCourseDetailResult {
  const [data, setData] = useState<SubjectDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  useEffect(() => {
    if (!courseId || !orgId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<SubjectDTO>(`/subjects/${courseId}?organizationId=${orgId}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [courseId, orgId, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { data, isLoading, error, refetch };
}
