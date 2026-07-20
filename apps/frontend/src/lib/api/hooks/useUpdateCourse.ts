import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import type { CourseDTO, UpdateCourseInput } from '../types';

interface UseUpdateCourseResult {
  update: (courseId: string, input: UpdateCourseInput) => Promise<CourseDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useUpdateCourse(): UseUpdateCourseResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(
    async (courseId: string, input: UpdateCourseInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.patch<CourseDTO>(`/courses/${courseId}`, input);
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
