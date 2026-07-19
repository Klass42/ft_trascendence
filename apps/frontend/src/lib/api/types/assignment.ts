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
