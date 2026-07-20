import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import type { CourseDTO, CreateCourseInput } from '../types';

interface UseCreateCourseResult {
  create: (input: CreateCourseInput) => Promise<CourseDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useCreateCourse(): UseCreateCourseResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (input: CreateCourseInput) => {
    setIsLoading(true);
    setError(null);
    try {
      return await apiClient.post<CourseDTO>('/courses', input);
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { create, isLoading, error };
}
