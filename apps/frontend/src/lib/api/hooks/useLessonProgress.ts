import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';

/** One student of the subject's cohort and the lessons they have completed. */
export interface StudentLessonProgress {
  userId: string;
  completedLessonIds: string[];
}

interface UseLessonProgressResult {
  data: StudentLessonProgress[] | null;
  isLoading: boolean;
  error: Error | null;
}

/** Per-student lesson progress of a subject. Subject staff and admins only. */
export function useLessonProgress(subjectId: string | undefined): UseLessonProgressResult {
  const [data, setData] = useState<StudentLessonProgress[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  useEffect(() => {
    if (!subjectId || !orgId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.get<StudentLessonProgress[]>(`/subjects/${subjectId}/lesson-progress?organizationId=${orgId}`)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err as Error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [subjectId, orgId]);

  return { data, isLoading, error };
}
