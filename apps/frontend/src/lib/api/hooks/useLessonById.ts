import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { LessonDTO } from '../types';

interface UseLessonByIdResult {
  data: LessonDTO | null;
  isLoading: boolean;
  error: Error | null;
}

export function useLessonById(lessonId: string | undefined): UseLessonByIdResult {
  const [data, setData] = useState<LessonDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
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
  }, [lessonId, orgId]);

  return { data, isLoading, error };
}
