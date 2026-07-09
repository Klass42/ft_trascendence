import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import type { AssignmentDTO, CreateAssignmentInput } from '../types';

interface UseCreateAssignmentResult {
  create: (
    courseId: string,
    input: CreateAssignmentInput,
  ) => Promise<AssignmentDTO>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Create an assignment in a course (teacher/assistant only — the backend
 * enforces the role). Identity comes from the x-dev-user header.
 */
export function useCreateAssignment(): UseCreateAssignmentResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (courseId: string, input: CreateAssignmentInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.post<AssignmentDTO>(
          `/courses/${courseId}/assignments`,
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

  return { create, isLoading, error };
}
