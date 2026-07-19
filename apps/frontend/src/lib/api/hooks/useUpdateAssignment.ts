import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import type { AssignmentDTO, UpdateAssignmentInput } from '../types';

interface UseUpdateAssignmentResult {
  update: (
    assignmentId: string,
    input: UpdateAssignmentInput,
  ) => Promise<AssignmentDTO>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Edit an assignment (teacher/assistant only — the backend enforces the role).
 * Identity comes from the x-dev-user header injected by the client.
 */
export function useUpdateAssignment(): UseUpdateAssignmentResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(
    async (assignmentId: string, input: UpdateAssignmentInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.patch<AssignmentDTO>(
          `/assignments/${assignmentId}`,
          input,
        );
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { update, isLoading, error };
}
