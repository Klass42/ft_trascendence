import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type {
  AnalyticsOverviewDTO,
  GradeDistributionDTO,
  SubmissionsOverTimeDTO,
} from '../types';

interface AnalyticsResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Small shared fetch hook for the staff-only analytics endpoints. Mirrors
 * {@link useGradebook}: identity (and tenant) come from the auth header, so the
 * backend returns 403/404 for non-staff/non-members — mount these only for
 * teachers/admins. `path` is memoised by the caller so the effect is stable.
 */
function useAnalyticsResource<T>(
  courseId: string | null,
  path: string | null,
): AnalyticsResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!courseId || !path || !user) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<T>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err as Error);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, path, user, nonce]);

  return { data, isLoading, error, refetch };
}

/** Course KPI headline (students, submissions, grades, forum activity). */
export function useAnalyticsOverview(courseId: string | null) {
  return useAnalyticsResource<AnalyticsOverviewDTO>(
    courseId,
    courseId ? `/subjects/${courseId}/analytics/overview` : null,
  );
}

/**
 * Daily submission counts over `[from, to]` (ISO dates, both optional — the
 * backend defaults to the last 30 days). The query string is rebuilt whenever
 * the range changes, which re-triggers the fetch.
 */
export function useSubmissionsOverTime(
  courseId: string | null,
  from?: string,
  to?: string,
) {
  let path: string | null = null;
  if (courseId) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    path = `/subjects/${courseId}/analytics/submissions-over-time${qs ? `?${qs}` : ''}`;
  }
  return useAnalyticsResource<SubmissionsOverTimeDTO>(courseId, path);
}

/** Normalised histogram of graded scores (ten 10-point bands). */
export function useGradeDistribution(courseId: string | null) {
  return useAnalyticsResource<GradeDistributionDTO>(
    courseId,
    courseId ? `/subjects/${courseId}/analytics/grade-distribution` : null,
  );
}

/**
 * Fetch the analytics CSV for a course and trigger a browser download. Reuses
 * the api client (so the auth header is injected) and reads the response as
 * text, then hands it to the browser as a Blob — same shape as
 * {@link downloadGradebookCsv}.
 */
export async function downloadAnalyticsCsv(
  courseId: string,
  filename = `analytics-${courseId}.csv`,
): Promise<void> {
  const csv = await apiClient.get<string>(
    `/subjects/${courseId}/analytics/export.csv`,
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
