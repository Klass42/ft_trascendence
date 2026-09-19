import { useCallback, useState } from 'react';
import { apiClient } from '../client';
import type { SaveAsTemplateInput, TaskTemplateDTO } from '../types';

interface UseSaveAsTemplateResult {
  save: (activityId: string, input?: SaveAsTemplateInput) => Promise<TaskTemplateDTO>;
  isLoading: boolean;
  error: Error | null;
}

/** Snapshot an activity's blocks into an org TaskTemplate. */
export function useSaveAsTemplate(): UseSaveAsTemplateResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(
    async (activityId: string, input?: SaveAsTemplateInput) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.post<TaskTemplateDTO>(
          `/activities/${activityId}/save-as-template`,
          input ?? {},
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

  return { save, isLoading, error };
}
