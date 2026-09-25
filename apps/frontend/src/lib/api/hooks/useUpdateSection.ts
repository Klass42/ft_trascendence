import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { SectionDTO, UpdateSectionInput } from '../types';

interface UseUpdateSectionResult {
  update: (
    courseId: string,
    sectionId: string,
    input: UpdateSectionInput,
  ) => Promise<SectionDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useUpdateSection(): UseUpdateSectionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const update = useCallback(
    async (courseId: string, sectionId: string, input: UpdateSectionInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.patch<SectionDTO>(
          `/subjects/${courseId}/sections/${sectionId}?organizationId=${orgId}`,
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
