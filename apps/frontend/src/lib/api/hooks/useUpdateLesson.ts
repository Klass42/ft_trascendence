import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { LessonDTO, UpdateLessonInput } from '../types';

interface UseUpdateLessonResult {
  update: (
    sectionId: string,
    lessonId: string,
    input: UpdateLessonInput,
  ) => Promise<LessonDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useUpdateLesson(): UseUpdateLessonResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const update = useCallback(
    async (
      sectionId: string,
      lessonId: string,
      input: UpdateLessonInput,
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.patch<LessonDTO>(
          `/sections/${sectionId}/lessons/${lessonId}?organizationId=${orgId}`,
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

  return { update, isLoading, error };
}
