import { useCallback, useState } from 'react';
import { apiClient } from '../client';
import type {
  CreateLearningResourceInput,
  LearningResourceDTO,
  PublishResourceInput,
  UpdateLearningResourceInput,
} from '../types';

export function useResourceMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async <T,>(action: () => Promise<T>) => {
    setIsLoading(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      const normalized = err as Error;
      setError(normalized);
      throw normalized;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    create: (input: CreateLearningResourceInput) =>
      run(() => apiClient.post<LearningResourceDTO>('/resources', input)),
    update: (id: string, input: UpdateLearningResourceInput) =>
      run(() => apiClient.patch<LearningResourceDTO>(`/resources/${id}`, input)),
    remove: (id: string) => run(() => apiClient.delete<void>(`/resources/${id}`)),
    publishToCourse: (id: string, input: PublishResourceInput) =>
      run(() => apiClient.post(`/resources/${id}/subjects`, input)),
    removeFromCourse: (id: string, subjectId: string) =>
      run(() => apiClient.delete<void>(`/resources/${id}/subjects/${subjectId}`)),
  };
}
