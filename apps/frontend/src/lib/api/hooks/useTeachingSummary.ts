import { useState, useEffect, useCallback, useRef } from 'react';
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
  // Refetches after the first load are silent so a live update does not blank the dashboard.
  const loadedRef = useRef(false);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!user) {
      setData(null);
      setIsLoading(false);
      loadedRef.current = false;
      return;
    }

    let cancelled = false;
    if (!loadedRef.current) setIsLoading(true);
    setError(null);

    apiClient
      .get<TeachingSummaryDTO>('/me/teaching/summary')
      .then((result) => {
        if (!cancelled) {
          setData(result);
          loadedRef.current = true;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err as Error);
          setData(null);
          loadedRef.current = false;
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
