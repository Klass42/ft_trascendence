import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { AttemptDTO, SaveAnswersInput } from '../types';

interface UseActivityAttemptsResult {
  attempts: AttemptDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  start: () => Promise<AttemptDTO>;
  save: (attemptId: string, input: SaveAnswersInput) => Promise<AttemptDTO>;
  submit: (attemptId: string) => Promise<AttemptDTO>;
  refetch: () => void;
}

/** Student-owned activity attempts. The API authorizes every operation server-side. */
export function useActivityAttempts(activityId: string | null): UseActivityAttemptsResult {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!activityId || !user) {
      setAttempts(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiClient
      .get<AttemptDTO[]>(`/activities/${activityId}/attempts/me`)
      .then((data) => !cancelled && setAttempts(data))
      .catch((err) => !cancelled && setError(err as Error))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [activityId, user, nonce]);

  const start = useCallback(async () => {
    if (!activityId) throw new Error('No hay actividad seleccionada.');
    const attempt = await apiClient.post<AttemptDTO>(`/activities/${activityId}/attempts`);
    setAttempts((previous) => {
      const rest = (previous ?? []).filter((item) => item.id !== attempt.id);
      return [...rest, attempt].sort((a, b) => a.attemptNo - b.attemptNo);
    });
    return attempt;
  }, [activityId]);

  const save = useCallback(async (attemptId: string, input: SaveAnswersInput) => {
    const attempt = await apiClient.patch<AttemptDTO>(`/attempts/${attemptId}`, input);
    setAttempts((previous) => previous?.map((item) => item.id === attempt.id ? attempt : item) ?? [attempt]);
    return attempt;
  }, []);

  const submit = useCallback(async (attemptId: string) => {
    const attempt = await apiClient.post<AttemptDTO>(`/attempts/${attemptId}/submit`);
    setAttempts((previous) => previous?.map((item) => item.id === attempt.id ? attempt : item) ?? [attempt]);
    return attempt;
  }, []);

  return { attempts, isLoading, error, start, save, submit, refetch };
}
