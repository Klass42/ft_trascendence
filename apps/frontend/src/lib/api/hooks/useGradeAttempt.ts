import { useCallback, useState } from 'react';
import { apiClient } from '../client';
import type { AttemptDTO, GradeAttemptInput } from '../types';

interface UseGradeAttemptResult {
  grade: (attemptId: string, input: GradeAttemptInput) => Promise<AttemptDTO>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Staff grades subjective answers on an attempt
 * (`PATCH /attempts/:id/grade` with `{ answers, feedback }`).
 */
export function useGradeAttempt(): UseGradeAttemptResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const grade = useCallback(async (attemptId: string, input: GradeAttemptInput) => {
    for (const item of input.answers) {
      if (!Number.isFinite(item.awarded) || item.awarded < 0) {
        throw new Error('Cada nota debe ser un número ≥ 0.');
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      return await apiClient.patch<AttemptDTO>(
        `/attempts/${attemptId}/grade`,
        input,
      );
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { grade, isLoading, error };
}
