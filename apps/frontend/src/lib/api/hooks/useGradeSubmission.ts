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

/**
 * Fetch the gradebook CSV for a course and trigger a browser download. Reuses
 * the api client (so the auth header is injected) and reads the response as
 * text, then hands it to the browser as a Blob.
 */
export async function downloadGradebookCsv(
  courseId: string,
  filename = `gradebook-${courseId}.csv`,
): Promise<void> {
  const csv = await apiClient.get<string>(`/courses/${courseId}/gradebook.csv`);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
