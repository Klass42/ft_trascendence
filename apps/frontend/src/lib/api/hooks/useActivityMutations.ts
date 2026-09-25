import { useCallback, useState } from 'react';
import { apiClient } from '../client';
import type {
  ActivityDTO,
  CreateActivityInput,
  CreateQuestionInput,
  QuestionDTO,
  UpdateActivityInput,
  UpdateQuestionInput,
} from '../types';

/**
 * Activity + question authoring mutations (staff only — the backend enforces the
 * course-staff role). Each returns `{ ..., isLoading, error }`. Grouped in one
 * file since they share the same shape and are always used together on the
 * authoring page.
 */
export function useActivityMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createActivity = useCallback(
    (courseId: string, input: CreateActivityInput) =>
      run(() =>
        apiClient.post<ActivityDTO>(`/subjects/${courseId}/activities`, input),
      ),
    [run],
  );

  const updateActivity = useCallback(
    (activityId: string, input: UpdateActivityInput) =>
      run(() =>
        apiClient.patch<ActivityDTO>(`/activities/${activityId}`, input),
      ),
    [run],
  );

  const deleteActivity = useCallback(
    (activityId: string) =>
      run(() => apiClient.delete<void>(`/activities/${activityId}`)),
    [run],
  );

  const createQuestion = useCallback(
    (activityId: string, input: CreateQuestionInput) =>
      run(() =>
        apiClient.post<QuestionDTO>(
          `/activities/${activityId}/questions`,
          input,
        ),
      ),
    [run],
  );

  const updateQuestion = useCallback(
    (questionId: string, input: UpdateQuestionInput) =>
      run(() =>
        apiClient.patch<QuestionDTO>(`/questions/${questionId}`, input),
      ),
    [run],
  );

  const deleteQuestion = useCallback(
    (questionId: string) =>
      run(() => apiClient.delete<void>(`/questions/${questionId}`)),
    [run],
  );

  const reorderQuestions = useCallback(
    (activityId: string, questionIds: string[]) =>
      run(() =>
        apiClient.patch<QuestionDTO[]>(
          `/activities/${activityId}/questions/reorder`,
          { questionIds },
        ),
      ),
    [run],
  );

  return {
    createActivity,
    updateActivity,
    deleteActivity,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    isLoading,
    error,
  };
}
