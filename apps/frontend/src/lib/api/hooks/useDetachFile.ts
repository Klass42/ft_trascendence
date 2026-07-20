import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';

interface UseDetachFileResult {
  detach: (lessonId: string, fileId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useDetachFile(): UseDetachFileResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const detach = useCallback(
    async (lessonId: string, fileId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await apiClient.delete(
          `/lessons/${lessonId}/attachments/${fileId}?organizationId=${orgId}`,
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

  return { detach, isLoading, error };
}
