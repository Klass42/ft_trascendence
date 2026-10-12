import { useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { MeSubjectDTO } from '../types';

interface UseMySubjectsResult {
  data: MeSubjectDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

/** Subjects the signed-in user may open. Not every published subject in the org. */
export function useMySubjects(): UseMySubjectsResult {
  const [data, setData] = useState<MeSubjectDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.organizationId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiClient.get<MeSubjectDTO[]>('/me/subjects')
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err as Error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [user?.organizationId]);

  return { data, isLoading, error };
}
