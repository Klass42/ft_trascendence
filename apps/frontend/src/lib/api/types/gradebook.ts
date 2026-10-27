/**
 * Gradebook & grading API DTOs.
 *
 * Shapes of GET /courses/:id/gradebook and GET /courses/:id/grades/me
 * (activities, not assignments). See spec §7.4.
 */

import type { AttemptStatus } from './activity';
import type { SubmissionAuthorDTO } from './assignment';

// =============================================================================
// Gradebook (staff)
// =============================================================================

/** An activity column in the gradebook matrix. */
export interface GradebookItemDTO {
  id: string;
  title: string;
  maxScore: number;
  dueAt: string | null;
  closeAt: string | null;
  countsTowardFinal: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

/** One student's score for one activity (a matrix cell). */
export interface GradebookCellDTO {
  activityId: string;
  /** Best GRADED attempt, or a SUBMITTED one if none is graded yet. */
  attemptId: string | null;
  /** Final score; only set when the cell is GRADED (null while SUBMITTED). */
  score: number | null;
  /** Auto-graded partial score of a SUBMITTED attempt. Never a grade: show "Por calificar". */
  partialScore: number | null;
  status: AttemptStatus | null;
}

/** One student row: the student plus a cell per item (same order) and final. */
export interface GradebookRowDTO {
  user: SubmissionAuthorDTO;
  cells: GradebookCellDTO[];
  final: number | null;
}

export interface GradebookDTO {
  course: { id: string; title: string };
  items: GradebookItemDTO[];
  students: GradebookRowDTO[];
}

// =============================================================================
// My grades (student)
// =============================================================================

export interface MyGradeDTO {
  activityId: string;
  title: string;
  maxScore: number;
  dueAt: string | null;
  countsTowardFinal: boolean;
  score: number | null;
  status: AttemptStatus | null;
  feedback: string | null;
  gradedAt: string | null;
}

export interface MyGradesDTO {
  course: { id: string; title: string };
  items: MyGradeDTO[];
  final: number | null;
}

/** Format the 0–1 final ratio as a percentage with one decimal (e.g. 75.0%). */
export function formatFinalPercent(final: number | null): string {
  if (final == null) return '—';
  return `${(Math.round(final * 1000) / 10).toFixed(1)}%`;
}
