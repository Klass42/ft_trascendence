import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import type { GradeSubmissionInput, SubmissionDTO } from '../types';

interface UseGradeSubmissionResult {
  grade: (
    submissionId: string,
    input: GradeSubmissionInput,
    maxScore: number,
  ) => Promise<SubmissionDTO>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Grade a submission (staff). Validates `0 <= score <= maxScore` on the client
 * too — the backend re-validates against the per-assignment maxScore, but we
 * fail fast to avoid a round-trip on obviously bad input.
 */
export function useGradeSubmission(): UseGradeSubmissionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const grade = useCallback(
    async (
      submissionId: string,
      input: GradeSubmissionInput,
      maxScore: number,
    ) => {
      if (
        !Number.isFinite(input.score) ||
        input.score < 0 ||
        input.score > maxScore
      ) {
        throw new Error(`La nota debe estar entre 0 y ${maxScore}.`);
      }

      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.patch<SubmissionDTO>(
          `/submissions/${submissionId}/grade`,
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

  return { grade, isLoading, error };
}
