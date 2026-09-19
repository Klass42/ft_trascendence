import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { TeachingActivityDTO } from '../types';

interface UseTeachingActivitiesResult {
  data: TeachingActivityDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Activities of courses the actor staffs (library «Anteriores»). */
export function useTeachingActivities(): UseTeachingActivitiesResult {
  const [data, setData] = useState<TeachingActivityDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!user) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiClient
      .get<TeachingActivityDTO[]>('/me/teaching/activities')
      .then((r) => !cancelled && setData(r))
      .catch((err) => {
        if (!cancelled) {
          setError(err as Error);
          setData(null);
        }
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  return { data, isLoading, error, refetch };
}
