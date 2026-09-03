export type LearningResourceType = 'BOOK' | 'DOCUMENT' | 'LINK' | 'VIDEO' | 'AUDIO';
export type LearningResourceStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** Deliberately excludes the storage bucket and object key. */
export interface ResourceFileDTO {
  id: string;
  originalName: string;
  contentType: string | null;
  sizeBytes: string;
  createdAt: string;
}

export interface ResourceCourseDTO {
  resourceId: string;
  courseId: string;
  order: number;
  required: boolean;
  course: { id: string; title: string };
}

export interface LearningResourceDTO {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  description: string | null;
  type: LearningResourceType;
  authors: string[];
  publisher: string | null;
  isbn: string | null;
  language: string | null;
  license: string | null;
  tags: string[];
  fileId: string | null;
  file: ResourceFileDTO | null;
  externalUrl: string | null;
  status: LearningResourceStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  courses: ResourceCourseDTO[];
}

export interface CourseResourceDTO {
  resourceId: string;
  courseId: string;
  order: number;
  required: boolean;
  resource: LearningResourceDTO;
}

export interface CreateLearningResourceInput {
  title: string;
  type: LearningResourceType;
  description?: string;
  authors?: string[];
  publisher?: string;
  isbn?: string;
  language?: string;
  license?: string;
  tags?: string[];
  fileId?: string;
  externalUrl?: string;
  status?: LearningResourceStatus;
}

export type UpdateLearningResourceInput = Partial<CreateLearningResourceInput> & {
  fileId?: string | null;
  externalUrl?: string | null;
  description?: string | null;
  publisher?: string | null;
  isbn?: string | null;
  language?: string | null;
  license?: string | null;
};

export interface PublishResourceInput {
  courseId: string;
  order?: number;
  required?: boolean;
}
