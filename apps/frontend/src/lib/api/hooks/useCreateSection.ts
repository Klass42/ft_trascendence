import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { SectionDTO, CreateSectionInput } from '../types';

interface UseCreateSectionResult {
  create: (courseId: string, input: CreateSectionInput) => Promise<SectionDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useCreateSection(): UseCreateSectionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const create = useCallback(
    async (courseId: string, input: CreateSectionInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.post<SectionDTO>(
          `/courses/${courseId}/sections?organizationId=${orgId}`,
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
