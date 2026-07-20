import { useState, useCallback } from 'react';
import { apiClient } from '../client';

interface UseDeleteCourseResult {
  remove: (courseId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useDeleteCourse(): UseDeleteCourseResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(async (courseId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/courses/${courseId}`);
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
