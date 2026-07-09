/**
 * Gradebook & grading API DTOs (Epic C).
 *
 * Exact shapes of the backend responses under apps/backend/src/assignments/grading.
 */

import type { SubmissionStatus } from './assignment';
import type { SubmissionAuthorDTO } from './assignment';

// =============================================================================
// Gradebook (staff)
// =============================================================================

/** An assignment column in the gradebook matrix. */
export interface GradebookAssignmentDTO {
  id: string;
  title: string;
  maxScore: number;
  dueAt: string | null;
}

/** One student's score for one assignment (a matrix cell). */
export interface GradebookCellDTO {
  assignmentId: string;
  /** Present only when the student has a submission — needed to grade it. */
  submissionId: string | null;
  score: number | null;
  status: SubmissionStatus | null;
}

/** One student row: the student plus a cell per assignment (same order). */
export interface GradebookRowDTO {
  user: SubmissionAuthorDTO;
  cells: GradebookCellDTO[];
}

export interface GradebookDTO {
  course: { id: string; title: string };
  assignments: GradebookAssignmentDTO[];
  students: GradebookRowDTO[];
}

// =============================================================================
// My grades (student)
// =============================================================================

export interface MyGradeDTO {
  assignmentId: string;
  title: string;
  maxScore: number;
  dueAt: string | null;
  score: number | null;
  status: SubmissionStatus | null;
  feedback: string | null;
  gradedAt: string | null;
}

// =============================================================================
// Request payloads
// =============================================================================

export interface GradeSubmissionInput {
  score: number;
  feedback?: string;
}
