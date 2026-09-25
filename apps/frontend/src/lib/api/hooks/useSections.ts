import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { SectionDTO } from '../types';

interface UseSectionsResult {
  data: SectionDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSections(courseId: string | undefined): UseSectionsResult {
  const [data, setData] = useState<SectionDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!courseId || !orgId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<SectionDTO[]>(`/subjects/${courseId}/sections?organizationId=${orgId}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [courseId, orgId, nonce]);

  return { data, isLoading, error, refetch };
}
