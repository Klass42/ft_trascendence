import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type {
  AnalyticsFilters,
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

/** `?from=…&to=…&type=…` for the filters that are set (empty string if none). */
function filtersQuery({ from, to, type }: AnalyticsFilters): string {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (type) params.set('type', type);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function analyticsPath(
  courseId: string | null,
  resource: string,
  filters: AnalyticsFilters,
): string | null {
  return courseId ? `/subjects/${courseId}/analytics/${resource}${filtersQuery(filters)}` : null;
}

/**
 * Course KPI headline (students, submissions, grades, forum activity) under
 * the same range / type filters as the charts. The query string is rebuilt
 * whenever a filter changes, which re-triggers the fetch.
 */
export function useAnalyticsOverview(courseId: string | null, filters: AnalyticsFilters = {}) {
  return useAnalyticsResource<AnalyticsOverviewDTO>(
    courseId,
    analyticsPath(courseId, 'overview', filters),
  );
}

/**
 * Daily submission counts over `[from, to]` (ISO dates, both optional — the
 * backend defaults to the last 30 days).
 */
export function useSubmissionsOverTime(courseId: string | null, filters: AnalyticsFilters = {}) {
  return useAnalyticsResource<SubmissionsOverTimeDTO>(
    courseId,
    analyticsPath(courseId, 'submissions-over-time', filters),
  );
}

/** Normalised histogram of graded scores (ten 10-point bands). */
export function useGradeDistribution(courseId: string | null, filters: AnalyticsFilters = {}) {
  return useAnalyticsResource<GradeDistributionDTO>(
    courseId,
    analyticsPath(courseId, 'grade-distribution', filters),
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
  filters: AnalyticsFilters = {},
  filename = `analytics-${courseId}.csv`,
): Promise<void> {
  const csv = await apiClient.get<string>(
    `/subjects/${courseId}/analytics/export.csv${filtersQuery(filters)}`,
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
