import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';

interface UseDeleteLessonResult {
  remove: (sectionId: string, lessonId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useDeleteLesson(): UseDeleteLessonResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const remove = useCallback(
    async (sectionId: string, lessonId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await apiClient.delete(
          `/sections/${sectionId}/lessons/${lessonId}?organizationId=${orgId}`,
        );
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { remove, isLoading, error };
}
