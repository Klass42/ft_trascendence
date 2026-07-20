import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';

interface UseReorderLessonsResult {
  reorder: (sectionId: string, orderedIds: string[]) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useReorderLessons(): UseReorderLessonsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const reorder = useCallback(
    async (sectionId: string, orderedIds: string[]) => {
      setIsLoading(true);
      setError(null);
      try {
        await apiClient.patch(
          `/sections/${sectionId}/lessons/reorder?organizationId=${orgId}`,
          { orderedIds },
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

  return { reorder, isLoading, error };
}
