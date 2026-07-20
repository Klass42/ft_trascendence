import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { LessonDTO, CreateLessonInput } from '../types';

interface UseCreateLessonResult {
  create: (sectionId: string, input: CreateLessonInput) => Promise<LessonDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useCreateLesson(): UseCreateLessonResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const create = useCallback(
    async (sectionId: string, input: CreateLessonInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.post<LessonDTO>(
          `/sections/${sectionId}/lessons?organizationId=${orgId}`,
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
    [orgId],
  );

  return { create, isLoading, error };
}
