import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { SectionDTO } from '../types';

interface UseSectionsResult {
  data: SectionDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useSections(courseId: string | undefined): UseSectionsResult {
  const [data, setData] = useState<SectionDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  useEffect(() => {
    if (!courseId || !orgId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<SectionDTO[]>(`/courses/${courseId}/sections?organizationId=${orgId}`)
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
  }, [courseId, orgId]);

  return { data, isLoading, error };
}
