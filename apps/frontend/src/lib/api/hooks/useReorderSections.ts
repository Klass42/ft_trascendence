import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';

interface UseReorderSectionsResult {
  reorder: (courseId: string, orderedIds: string[]) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useReorderSections(): UseReorderSectionsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const reorder = useCallback(
    async (courseId: string, orderedIds: string[]) => {
      setIsLoading(true);
      setError(null);
      try {
        await apiClient.patch(
          `/courses/${courseId}/sections/reorder?organizationId=${orgId}`,
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
