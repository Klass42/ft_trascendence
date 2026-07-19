import { useState, useCallback } from 'react';
import { apiClient } from '../client';

interface UseDeleteAssignmentResult {
  remove: (assignmentId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Delete an assignment (teacher/assistant only — the backend enforces the
 * role). Identity comes from the x-dev-user header injected by the client.
 */
export function useDeleteAssignment(): UseDeleteAssignmentResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(async (assignmentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/assignments/${assignmentId}`);
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { remove, isLoading, error };
}
