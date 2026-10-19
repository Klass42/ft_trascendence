import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { LessonDTO } from '../types';

interface UseLessonByIdResult {
  data: LessonDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useLessonById(lessonId: string | undefined): UseLessonByIdResult {
  const [data, setData] = useState<LessonDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  useEffect(() => {
    if (!lessonId || !orgId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<LessonDTO>(`/lessons/${lessonId}?organizationId=${orgId}`)
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
  }, [lessonId, orgId, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { data, isLoading, error, refetch };
}
