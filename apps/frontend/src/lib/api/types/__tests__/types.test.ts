/**
 * Type verification test for API DTOs
 *
 * Compile-time verification that our DTO types are correct.
 * If this file compiles, all types are properly exported and
 * compatible with actual API response shapes.
 */

import type {
  CourseDTO,
  SectionDTO,
  LessonDTO,
  FileDTO,
  LessonAttachmentDTO,
  EnrollmentDTO,
  ProgressDTO,
  CompleteLessonDTO,
  CourseStatus,
  CourseRole,
} from '../../types';

// =============================================================================
// CourseDTO shape verification
// =============================================================================

type _CourseShape = {
  id: string;
  organizationId: string;
  ownerId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  accessCode: string | null;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
};

// Ensure CourseDTO matches the expected shape
type _CourseCheck = CourseDTO extends _CourseShape ? true : false;
const _c: _CourseCheck = true;

// All status values are valid
type _StatusCheck = 'DRAFT' extends CourseStatus ? 'PUBLISHED' extends CourseStatus ? 'ARCHIVED' extends CourseStatus ? true : false : false : false;
const _s: _StatusCheck = true;

// =============================================================================
// SectionDTO shape verification
// =============================================================================

type _SectionShape = {
  id: string;
  courseId: string;
  title: string;
  order: number;
  createdAt: string;
  lessons?: LessonDTO[];
};

type _SectionCheck = SectionDTO extends _SectionShape ? true : false;
const _sec: _SectionCheck = true;

// =============================================================================
// LessonDTO shape verification
// =============================================================================

type _LessonShape = {
  id: string;
  sectionId: string;
  title: string;
  contentMd: string | null;
  videoUrl: string | null;
  order: number;
  createdAt: string;
  attachments?: LessonAttachmentDTO[];
};

type _LessonCheck = LessonDTO extends _LessonShape ? true : false;
const _l: _LessonCheck = true;

// =============================================================================
// FileDTO shape verification
// =============================================================================

type _FileShape = {
  id: string;
  organizationId: string;
  uploaderId: string | null;
  bucket: string;
  objectKey: string;
  originalName: string;
  contentType: string | null;
  sizeBytes: string;
  createdAt: string;
};

type _FileCheck = FileDTO extends _FileShape ? true : false;
const _f: _FileCheck = true;

// =============================================================================
// LessonAttachmentDTO shape verification
// =============================================================================

type _AttachmentShape = {
  lessonId: string;
  fileId: string;
  file: FileDTO;
};

type _AttachmentCheck = LessonAttachmentDTO extends _AttachmentShape ? true : false;
const _a: _AttachmentCheck = true;

// =============================================================================
// EnrollmentDTO shape verification
// =============================================================================

type _EnrollmentShape = {
  id: string;
  courseId: string;
  userId: string;
  role: CourseRole;
  progress: number;
  createdAt: string;
};

type _EnrollmentCheck = EnrollmentDTO extends _EnrollmentShape ? true : false;
const _e: _EnrollmentCheck = true;

// All role values are valid
type _RoleCheck = 'TEACHER' extends CourseRole ? 'ASSISTANT' extends CourseRole ? 'STUDENT' extends CourseRole ? true : false : false : false;
const _r: _RoleCheck = true;

// =============================================================================
// ProgressDTO shape verification
// =============================================================================

type _ProgressShape = {
  progress: number;
  completed: number;
  total: number;
};

type _ProgressCheck = ProgressDTO extends _ProgressShape ? true : false;
const _p: _ProgressCheck = true;

// =============================================================================
// CompleteLessonDTO shape verification
// =============================================================================

type _CompleteShape = {
  completed: boolean;
  progress: number;
};

type _CompleteCheck = CompleteLessonDTO extends _CompleteShape ? true : false;
const _cl: _CompleteCheck = true;

// =============================================================================
// Barrel export verification
// =============================================================================

// Suppress unused variable warnings — these serve as compile-time assertions
void [_c, _s, _sec, _l, _f, _a, _e, _r, _p, _cl];
