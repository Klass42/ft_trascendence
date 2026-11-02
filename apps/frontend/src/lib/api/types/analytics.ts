/**
 * Analytics dashboard API DTOs (Epic 6 — David).
 *
 * Exact shapes of the backend responses under apps/backend/src/analytics.
 */

// =============================================================================
// Overview / KPIs
// =============================================================================

/** Activity type accepted by the `type` filter (same values as the backend enum). */
export type AnalyticsActivityType = 'QUIZ' | 'LISTENING' | 'SPEAKING';

/** Filters shared by every analytics endpoint; empty values mean "no filter". */
export interface AnalyticsFilters {
  /** Inclusive UTC day, `YYYY-MM-DD`. */
  from?: string;
  /** Inclusive UTC day, `YYYY-MM-DD`. */
  to?: string;
  type?: AnalyticsActivityType;
}

export interface AnalyticsOverviewDTO {
  course: { id: string; title: string };
  /** Filters the backend actually applied (null = not filtered). */
  filters: { from: string | null; to: string | null; type: AnalyticsActivityType | null };
  students: number;
  /** Gradable (non-draft) activities; retained under its legacy API key. */
  assignments: number;
  lessons: number;
  submissions: {
    /** (student, activity) pairs with a SUBMITTED or GRADED attempt (inside the range, if any). */
    total: number;
    /** students × gradable activities. */
    expected: number;
    /** Delivered pairs with a grade; equals the notes behind `averageGrade`. */
    graded: number;
    /** Delivered pairs still awaiting manual grading. */
    pending: number;
    /** total / expected, in [0,1]. */
    rate: number;
  };
  /** Mean of the gradebook's best GRADED attempt per student/activity, as % of maxScore. */
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
