import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import type { AssignmentDTO } from '../types';

interface UseUpcomingAssignmentsResult {
  data: AssignmentDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Aggregate assignments across multiple courses and find upcoming ones.
 * Used by StudentDashboard to show the next due assignment.
 */
export function useUpcomingAssignments(
  courseIds: string[] | undefined,
): UseUpcomingAssignmentsResult {
  const [data, setData] = useState<AssignmentDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!courseIds || courseIds.length === 0) {
      setData([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all(
      courseIds.map((id) =>
        apiClient
          .get<AssignmentDTO[]>(`/courses/${id}/assignments`)
          .catch(() => [] as AssignmentDTO[]),
      ),
    )
      .then((results) => {
        if (!cancelled) {
          const all = results.flat();
          all.sort(
            (a, b) =>
              new Date(a.dueAt ?? a.createdAt).getTime() -
              new Date(b.dueAt ?? b.createdAt).getTime(),
          );
          setData(all);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseIds]);

  return { data, isLoading, error };
}
