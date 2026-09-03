/**
 * Course API DTOs
 *
 * Exact shapes of the backend API responses (Prisma models).
 */

// =============================================================================
// Enums
// =============================================================================

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type CourseRole = 'TEACHER' | 'ASSISTANT' | 'STUDENT';

// =============================================================================
// Course
// =============================================================================

export interface CourseDTO {
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
}

/** Safe metadata exposed before a learner joins a published course. */
export interface CoursePreviewDTO {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  status: CourseStatus;
}

// =============================================================================
// Section
// =============================================================================

export interface SectionDTO {
  id: string;
  courseId: string;
  title: string;
  order: number;
  createdAt: string;
  lessons?: LessonDTO[];
}

// =============================================================================
// Lesson
// =============================================================================

export interface LessonDTO {
  id: string;
  sectionId: string;
  title: string;
  contentMd: string | null;
  videoUrl: string | null;
  order: number;
  createdAt: string;
  attachments?: LessonAttachmentDTO[];
}

// =============================================================================
// File
// =============================================================================

export interface FileDTO {
  id: string;
  organizationId: string;
  uploaderId: string | null;
  bucket: string;
  objectKey: string;
  originalName: string;
  contentType: string | null;
  sizeBytes: string; // BigInt serialized as string
  createdAt: string;
}

// =============================================================================
// Lesson Attachment
// =============================================================================

export interface LessonAttachmentDTO {
  lessonId: string;
  fileId: string;
  file: FileDTO;
}

// =============================================================================
// Enrollment
// =============================================================================

export interface EnrollmentDTO {
  id: string;
  courseId: string;
  userId: string;
  role: CourseRole;
  progress: number;
  createdAt: string;
}

// =============================================================================
// Progress
// =============================================================================

export interface ProgressDTO {
  progress: number;
  completed: number;
  total: number;
}

export interface CompleteLessonDTO {
  completed: boolean;
  progress: number;
}

// =============================================================================
// My Progress (batch)
// =============================================================================

export interface MyProgressItem {
  courseId: string;
  percentage: number;
}

// =============================================================================
// Request payloads
// =============================================================================

export interface CreateCourseInput {
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  accessCode?: string;
  status?: CourseStatus;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  accessCode?: string;
  status?: CourseStatus;
}

export interface CreateSectionInput {
  title: string;
  order?: number;
}

export interface UpdateSectionInput {
  title?: string;
  order?: number;
}

export interface CreateLessonInput {
  title: string;
  contentMd?: string;
  videoUrl?: string;
  order?: number;
}

export interface UpdateLessonInput {
  title?: string;
  contentMd?: string;
  videoUrl?: string;
  order?: number;
}
