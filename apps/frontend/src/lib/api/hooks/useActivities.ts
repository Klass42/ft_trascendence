import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { ActivityDTO } from '../types';

interface UseActivitiesResult {
  data: ActivityDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * List a course's activities. The tenant is derived server-side from identity;
 * students receive only PUBLISHED activities with answer keys stripped.
 */
export function useActivities(courseId: string | null): UseActivitiesResult {
  const [data, setData] = useState<ActivityDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!courseId || !user) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiClient
      .get<ActivityDTO[]>(`/subjects/${courseId}/activities`)
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
  }, [courseId, user, nonce]);

  return { data, isLoading, error, refetch };
}

interface UseActivityResult {
  data: ActivityDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** A single activity with its questions (answer keys stripped for students). */
export function useActivity(activityId: string | null): UseActivityResult {
  const [data, setData] = useState<ActivityDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!activityId || !user) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiClient
      .get<ActivityDTO>(`/activities/${activityId}`)
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
  }, [activityId, user, nonce]);

  return { data, isLoading, error, refetch };
}
