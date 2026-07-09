import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import type { CreateSubmissionInput, SubmissionDTO } from '../types';

interface UseSubmitAssignmentResult {
  submit: (
    assignmentId: string,
    input: CreateSubmissionInput,
  ) => Promise<SubmissionDTO>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Create/update a submission. Files must already be uploaded via the shared
 * `/files` endpoint (the FileUpload component does this); we only send their
 * ids here. Identity comes from the x-dev-user header injected by the client.
 */
export function useSubmitAssignment(): UseSubmitAssignmentResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(
    async (assignmentId: string, input: CreateSubmissionInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.post<SubmissionDTO>(
          `/assignments/${assignmentId}/submissions`,
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

  return { submit, isLoading, error };
}
