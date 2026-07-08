import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';

interface UseCompletedLessonsResult {
  data: string[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useCompletedLessons(courseId: string | undefined): UseCompletedLessonsResult {
  const [data, setData] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const userId = user?.userId;

  useEffect(() => {
    if (!courseId || !orgId || !userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<string[]>(
      `/courses/${courseId}/completed-lessons?organizationId=${orgId}&userId=${userId}`
    )
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
  }, [courseId, orgId, userId]);

  return { data, isLoading, error };
}
