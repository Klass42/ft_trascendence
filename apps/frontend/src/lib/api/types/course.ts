/**
 * Cohort and subject API DTOs.
 *
 * A Course is a cohort (level + group + academic year). A Subject is one
 * taught offering inside that cohort.
 */

export type CohortStatus = 'PLANNED' | 'ACTIVE' | 'ARCHIVED';
export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type SubjectStaffRole = 'TEACHER' | 'ASSISTANT';

export interface CourseDTO {
  id: string;
  organizationId: string;
  name: string;
  academicYear: string;
  startsOn: string;
  endsOn: string;
  status: CohortStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectCourseRef {
  id: string;
  name: string;
  academicYear: string;
  status?: CohortStatus;
}

export interface SubjectDTO {
  id: string;
  organizationId: string;
  courseId: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  status: PublicationStatus;
  createdAt: string;
  updatedAt: string;
  course?: SubjectCourseRef;
}

/** Row from GET /me/subjects. The option value is the subject id. */
export interface MeSubjectDTO {
  id: string;
  title: string;
  status: PublicationStatus;
  course: { id: string; name: string; academicYear: string; status: CohortStatus };
}

export function subjectSelectorLabel(subject: {
  title: string;
  course: { name: string; academicYear: string };
}): string {
  const title = subject.title.trim();
  const cohort = subject.course.name.trim();
  const academicYear = subject.course.academicYear.trim();
  const alreadyIncludesYear = academicYear.length > 0 &&
    (title.includes(academicYear) || cohort.includes(academicYear));
  return [title, cohort, !alreadyIncludesYear && academicYear ? academicYear : '']
    .filter(Boolean)
    .join(' · ');
}

export interface SectionDTO {
  id: string;
  subjectId: string;
  title: string;
  order: number;
  createdAt: string;
  lessons?: LessonDTO[];
}

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

export interface FileDTO {
  id: string;
  organizationId: string;
  uploaderId: string | null;
  bucket: string;
  objectKey: string;
  originalName: string;
  contentType: string | null;
  sizeBytes: string;
  createdAt: string;
}

export interface LessonAttachmentDTO {
  lessonId: string;
  fileId: string;
  file: FileDTO;
}

export interface CourseMembershipDTO {
  id: string;
  courseId: string;
  userId: string;
  createdAt: string;
  progress?: number;
}

export interface SubjectStaffDTO {
  id: string;
  subjectId: string;
  userId: string;
  role: SubjectStaffRole;
  createdAt: string;
}

export interface ProgressDTO {
  progress: number;
  completed: number;
  total: number;
}

export interface CompleteLessonDTO {
  completed: boolean;
  progress: number;
}

/** Row from GET /me/pending-activities: still to hand in, soonest deadline first. */
export interface PendingActivityDTO {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  openAt: string | null;
  dueAt: string | null;
  closeAt: string | null;
  attemptsAllowed: number;
  attemptsUsed: number;
  inProgress: boolean;
}

export interface MyProgressItem {
  subjectId: string;
  courseId: string;
  percentage: number;
}

export interface CreateCourseInput {
  name: string;
  academicYear: string;
  startsOn: string;
  endsOn: string;
  status?: CohortStatus;
}

export interface UpdateCourseInput {
  name?: string;
  academicYear?: string;
  startsOn?: string;
  endsOn?: string;
  status?: CohortStatus;
}

export interface CreateSubjectInput {
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  status?: PublicationStatus;
}

export interface UpdateSubjectInput {
  title?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  status?: PublicationStatus;
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
