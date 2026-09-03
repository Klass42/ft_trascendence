import { useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { CoursePreviewDTO } from '../types';

interface UseCoursePreviewResult {
  data: CoursePreviewDTO | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches only safe metadata for a published course while a learner is not
 * yet enrolled. `enabled` prevents an unnecessary public request for members.
 */
export function useCoursePreview(
  courseId: string | undefined,
  enabled: boolean,
): UseCoursePreviewResult {
  const [data, setData] = useState<CoursePreviewDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  useEffect(() => {
    if (!courseId || !orgId || !enabled) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<CoursePreviewDTO>(`/courses/${courseId}/preview?organizationId=${orgId}`)
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
  }, [courseId, enabled, orgId]);

  return { data, isLoading, error };
}
