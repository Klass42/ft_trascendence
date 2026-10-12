import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import type { SubjectDTO, UpdateSubjectInput } from '../types';

interface UseUpdateCourseResult {
  update: (subjectId: string, input: UpdateSubjectInput) => Promise<SubjectDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useUpdateCourse(): UseUpdateCourseResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(
    async (subjectId: string, input: UpdateSubjectInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.patch<SubjectDTO>(`/subjects/${subjectId}`, input);
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
