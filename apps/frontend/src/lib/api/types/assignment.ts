/**
 * Assignment & Submission API DTOs
 *
 * Exact shapes of the backend API responses (Prisma models). See
 * apps/backend/src/assignments.
 */

import type { FileDTO } from './course';

// =============================================================================
// Enums
// =============================================================================

export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'LATE' | 'GRADED';

// =============================================================================
// Assignment
// =============================================================================

/** A teacher's prompt attachment on an assignment (mirrors SubmissionFileDTO). */
export interface AssignmentFileDTO {
  assignmentId: string;
  fileId: string;
  file: FileDTO;
}

export interface AssignmentDTO {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  /** Submission window (all optional). */
  openAt: string | null;
  dueAt: string | null;
  closeAt: string | null;
  maxScore: number;
  createdAt: string;
  updatedAt: string;
  /** Teacher's prompt attachments; present on the assignment reads. */
  files?: AssignmentFileDTO[];
}

// =============================================================================
// Submission
// =============================================================================

export interface SubmissionFileDTO {
  submissionId: string;
  fileId: string;
  file: FileDTO;
}

/** Minimal author shape included on submissions for the teacher's list view. */
export interface SubmissionAuthorDTO {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface SubmissionDTO {
  id: string;
  assignmentId: string;
  userId: string;
  text: string | null;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  gradedById: string | null;
  gradedAt: string | null;
  createdAt: string;
  updatedAt: string;
  files: SubmissionFileDTO[];
  /** Present on the teacher's list endpoint only. */
  user?: SubmissionAuthorDTO;
}

// =============================================================================
// Teacher dashboard summary (A4-teacher)
// =============================================================================

/** One ungraded attempt awaiting the teacher's attention. */
export interface PendingAttemptDTO {
  attemptId: string;
  status: 'SUBMITTED' | 'GRADED' | 'IN_PROGRESS';
  submittedAt: string | null;
  student: SubmissionAuthorDTO;
  activityId: string;
  activityTitle: string;
  courseId: string;
  courseTitle: string;
}

/** Aggregated figures for the teacher dashboard (GET /me/teaching/summary). */
export interface TeachingSummaryDTO {
  activeCourses: number;
  totalStudents: number;
  pendingCount: number;
  pending: PendingAttemptDTO[];
}

/** @deprecated Use PendingAttemptDTO — summary now lists SUBMITTED attempts. */
export type PendingSubmissionDTO = PendingAttemptDTO;

// =============================================================================
// Request payloads
// =============================================================================

export interface CreateAssignmentInput {
  title: string;
  description?: string;
  openAt?: string;
  dueAt?: string;
  closeAt?: string;
  maxScore?: number;
  fileIds?: string[];
}

/** PATCH payload; `null` on a window field clears that bound. */
export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  openAt?: string | null;
  dueAt?: string | null;
  closeAt?: string | null;
  maxScore?: number;
  fileIds?: string[];
}

export interface CreateSubmissionInput {
  text?: string;
  status?: 'DRAFT' | 'SUBMITTED';
  fileIds?: string[];
}

/** Legacy PATCH /submissions/:id/grade body (410 after cutover). */
export interface GradeSubmissionInput {
  score: number;
  feedback?: string;
}
