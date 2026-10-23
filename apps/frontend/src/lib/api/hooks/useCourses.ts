import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { CourseDTO } from '../types';

interface UseCoursesResult {
  data: CourseDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useCourses(status?: string, search?: string): UseCoursesResult {
  const [data, setData] = useState<CourseDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    apiClient.get<CourseDTO[]>(`/courses?${params}`)
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
  }, [orgId, status, search]);

  return { data, isLoading, error };
}
