import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';

interface UseDeleteSectionResult {
  remove: (courseId: string, sectionId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useDeleteSection(): UseDeleteSectionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const remove = useCallback(
    async (courseId: string, sectionId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await apiClient.delete(
          `/courses/${courseId}/sections/${sectionId}?organizationId=${orgId}`,
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
