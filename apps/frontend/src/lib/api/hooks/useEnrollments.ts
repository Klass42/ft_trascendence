import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';

/** Enrollment row as returned by GET /courses/:id/enrollments (no user include). */
export interface EnrollmentRow {
  id: string;
  userId: string;
  courseId: string;
  role: 'TEACHER' | 'ASSISTANT' | 'STUDENT';
  progress: number;
  createdAt: string;
}

interface UseEnrollmentsResult {
  data: EnrollmentRow[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch course enrollments. Passes organizationId as query param (enrollments
 * module uses the temporary @Query pattern — don't touch Aloiki's module).
 */
export function useEnrollments(courseId: string | undefined): UseEnrollmentsResult {
  const { user } = useAuth();
  const [data, setData] = useState<EnrollmentRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!courseId || !user) return;
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<EnrollmentRow[]>(
        `/courses/${courseId}/enrollments?organizationId=${user.organizationId}`,
      )
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [courseId, nonce, user]);

  return { data, isLoading, error, refetch };
}
