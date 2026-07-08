import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { EnrollmentDTO } from '../types';

interface UseEnrollResult {
  enroll: (courseId: string, accessCode?: string) => Promise<EnrollmentDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useEnroll(): UseEnrollResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const enroll = useCallback(async (courseId: string, accessCode?: string) => {
    const u = userRef.current;
    if (!u) throw new Error('Not authenticated');

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.post<EnrollmentDTO>(
        `/courses/${courseId}/enroll?organizationId=${u.organizationId}&userId=${u.userId}`,
        accessCode ? { accessCode } : undefined,
      );
      return result;
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { enroll, isLoading, error };
}
