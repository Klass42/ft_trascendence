/**
 * Type verification test for API DTOs
 *
 * Compile-time verification that our DTO types are correct.
 * If this file compiles, all types are properly exported and
 * compatible with actual API response shapes.
 */

import type {
  CourseDTO,
  SubjectDTO,
  SectionDTO,
  LessonDTO,
  FileDTO,
  LessonAttachmentDTO,
  CourseMembershipDTO,
  ProgressDTO,
  CompleteLessonDTO,
  CohortStatus,
  PublicationStatus,
  SubjectStaffRole,
} from '../../types';

type _CourseShape = {
  id: string;
  organizationId: string;
  name: string;
  academicYear: string;
  startsOn: string;
  endsOn: string;
  status: CohortStatus;
  createdAt: string;
  updatedAt: string;
};

type _CourseCheck = CourseDTO extends _CourseShape ? true : false;
const _c: _CourseCheck = true;

type _SubjectShape = {
  id: string;
  organizationId: string;
  courseId: string;
  title: string;
  status: PublicationStatus;
};

type _SubjectCheck = SubjectDTO extends _SubjectShape ? true : false;
const _sub: _SubjectCheck = true;
void _sub;

type _StatusCheck = 'DRAFT' extends PublicationStatus ? 'PUBLISHED' extends PublicationStatus ? 'ARCHIVED' extends PublicationStatus ? true : false : false : false;
const _s: _StatusCheck = true;

type _SectionShape = {
  id: string;
  subjectId: string;
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
  createdAt: string;
};

type _EnrollmentCheck = CourseMembershipDTO extends _EnrollmentShape ? true : false;
const _e: _EnrollmentCheck = true;

type _RoleCheck = 'TEACHER' extends SubjectStaffRole ? 'ASSISTANT' extends SubjectStaffRole ? true : false : false;
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
