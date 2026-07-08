import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { CourseDTO } from '../types';

interface UseCourseDetailResult {
  data: CourseDTO | null;
  isLoading: boolean;
  error: Error | null;
}

export function useCourseDetail(courseId: string | undefined): UseCourseDetailResult {
  const [data, setData] = useState<CourseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  useEffect(() => {
    if (!courseId || !orgId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<CourseDTO>(`/courses/${courseId}?organizationId=${orgId}`)
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
  }, [courseId, orgId]);

  return { data, isLoading, error };
}
