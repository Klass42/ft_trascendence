import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { MyProgressItem } from '../types';

interface UseMyProgressResult {
  data: MyProgressItem[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMyProgress(): UseMyProgressResult {
  const [data, setData] = useState<MyProgressItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const userId = user?.userId;

  useEffect(() => {
    if (!orgId || !userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<MyProgressItem[]>(
      `/enrollments/my-progress?organizationId=${orgId}&userId=${userId}`
    )
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
  }, [orgId, userId]);

  return { data, isLoading, error };
}
