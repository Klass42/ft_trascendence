import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import type { ActivityDTO } from '../types';

interface UseUpcomingAssignmentsResult {
  data: ActivityDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Aggregate published activities across courses for the student dashboard
 * "próxima entrega" card. Assignment writes are gone; GET /assignments is
 * not the product surface anymore.
 */
export function useUpcomingAssignments(
  courseIds: string[] | undefined,
): UseUpcomingAssignmentsResult {
  const [data, setData] = useState<ActivityDTO[] | null>(null);
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
          .get<ActivityDTO[]>(`/courses/${id}/activities`)
          .catch(() => [] as ActivityDTO[]),
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
