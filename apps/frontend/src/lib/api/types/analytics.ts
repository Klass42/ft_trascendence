/**
 * Analytics dashboard API DTOs (Epic 6 — David).
 *
 * Exact shapes of the backend responses under apps/backend/src/analytics.
 */

// =============================================================================
// Overview / KPIs
// =============================================================================

export interface AnalyticsOverviewDTO {
  course: { id: string; title: string };
  students: number;
  assignments: number;
  lessons: number;
  submissions: {
    /** Handed in (SUBMITTED + LATE + GRADED). */
    total: number;
    /** students × assignments. */
    expected: number;
    graded: number;
    /** SUBMITTED + LATE, i.e. awaiting a grade. */
    pending: number;
    /** total / expected, in [0,1]. */
    rate: number;
  };
  /** Mean GRADED score normalised to maxScore, as a percentage; null if none. */
  averageGrade: number | null;
  lessonsCompletion: {
    completed: number;
    /** students × lessons. */
    expected: number;
    /** completed / expected, in [0,1]. */
    rate: number;
  };
  forum: { threads: number; posts: number };
}

// =============================================================================
// Submissions over time
// =============================================================================

export interface SubmissionsSeriesPointDTO {
  /** UTC day, `YYYY-MM-DD`. */
  date: string;
  count: number;
}

export interface SubmissionsOverTimeDTO {
  from: string;
  to: string;
  total: number;
  series: SubmissionsSeriesPointDTO[];
}

// =============================================================================
// Grade distribution
// =============================================================================

export interface GradeBucketDTO {
  /** e.g. "80-90". */
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface GradeDistributionDTO {
  total: number;
  buckets: GradeBucketDTO[];
}
