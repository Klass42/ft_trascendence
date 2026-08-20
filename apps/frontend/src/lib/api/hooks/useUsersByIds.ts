import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import type { RosterUserDTO } from '@/features/courses/types';

interface UseUsersByIdsResult {
  data: RosterUserDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Batch-fetch user display data for the roster (GET /users/by-ids?ids=a,b,c).
 * Empty ids array → returns empty array without making a request.
 */
export function useUsersByIds(ids: string[]): UseUsersByIdsResult {
  const [data, setData] = useState<RosterUserDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const key = ids.sort().join(',');

  useEffect(() => {
    if (ids.length === 0) {
      setData([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<RosterUserDTO[]>(`/users/by-ids?ids=${encodeURIComponent(key)}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading, error };
}
