import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { GradebookDTO } from '../types';

interface UseGradebookResult {
  data: GradebookDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * The full gradebook (students × activities) for a course — staff only. The
 * backend returns 403 for non-staff, so mount this only for teachers/assistants.
 * Identity (and tenant) is derived server-side from the injected header.
 */
export function useGradebook(courseId: string | null): UseGradebookResult {
  const [data, setData] = useState<GradebookDTO | null>(null);
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
      .get<GradebookDTO>(`/courses/${courseId}/gradebook`)
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
  }, [courseId, user, nonce]);

  return { data, isLoading, error, refetch };
}

/**
 * Fetch the gradebook CSV for a course and trigger a browser download. Reuses
 * the api client (so the auth header is injected) and reads the response as
 * text, then hands it to the browser as a Blob.
 */
export async function downloadGradebookCsv(
  courseId: string,
  filename = `gradebook-${courseId}.csv`,
): Promise<void> {
  const csv = await apiClient.get<string>(`/courses/${courseId}/gradebook.csv`);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
