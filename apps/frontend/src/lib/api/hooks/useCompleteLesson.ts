import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { CompleteLessonDTO } from '../types';

interface UseCompleteLessonResult {
  completeLesson: (lessonId: string) => Promise<CompleteLessonDTO>;
  /** Removes the caller's own completion of the lesson. */
  uncompleteLesson: (lessonId: string) => Promise<CompleteLessonDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useCompleteLesson(): UseCompleteLessonResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const completeLesson = useCallback(async (lessonId: string) => {
    const u = userRef.current;
    if (!u) throw new Error('Not authenticated');

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.post<CompleteLessonDTO>(
        `/lessons/${lessonId}/complete?organizationId=${u.organizationId}&userId=${u.userId}`,
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

  const uncompleteLesson = useCallback(async (lessonId: string) => {
    const u = userRef.current;
    if (!u) throw new Error('Not authenticated');

    setIsLoading(true);
    setError(null);

    try {
      return await apiClient.delete<CompleteLessonDTO>(
        `/lessons/${lessonId}/complete?organizationId=${u.organizationId}&userId=${u.userId}`,
      );
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { completeLesson, uncompleteLesson, isLoading, error };
}
