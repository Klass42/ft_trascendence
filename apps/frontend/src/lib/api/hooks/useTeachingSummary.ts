import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { TeachingSummaryDTO } from '../types';

interface UseTeachingSummaryResult {
  data: TeachingSummaryDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Aggregated teacher-dashboard figures across every course the acting user
 * teaches (GET /me/teaching/summary): active courses, distinct students, and
 * the list of ungraded submissions. Identity (and tenant) is derived
 * server-side from the injected header. Mount only for staff.
 */
export function useTeachingSummary(): UseTeachingSummaryResult {
  const [data, setData] = useState<TeachingSummaryDTO | null>(null);
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
      .get<TeachingSummaryDTO>('/me/teaching/summary')
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err as Error);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  return { data, isLoading, error, refetch };
}
