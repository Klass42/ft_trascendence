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

export interface ResourceSubjectDTO {
  resourceId: string;
  subjectId: string;
  order: number;
  required: boolean;
  subject: { id: string; title: string };
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
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  subjects: ResourceSubjectDTO[];
}

export interface SubjectResourceDTO {
  resourceId: string;
  subjectId: string;
  order: number;
  required: boolean;
  /** Set when the row comes from a live-published folder (#26). */
  viaFolderId?: string;
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
  folderId?: string;
}

export type UpdateLearningResourceInput = Partial<Omit<CreateLearningResourceInput, 'folderId' | 'fileId' | 'externalUrl' | 'description' | 'publisher' | 'isbn' | 'language' | 'license'>> & {
  fileId?: string | null;
  externalUrl?: string | null;
  description?: string | null;
  publisher?: string | null;
  isbn?: string | null;
  language?: string | null;
  license?: string | null;
  folderId?: string | null;
};

export interface PublishResourceInput {
  subjectId: string;
  order?: number;
  required?: boolean;
}

/** Real library folder (#26). */
export interface ResourceFolderDTO {
  id: string;
  organizationId: string;
  createdById: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  subjects: { folderId: string; subjectId: string; required: boolean; subject: { id: string; title: string; courseId: string } }[];
  _count: { resources: number; children: number };
}

export interface BatchDeleteInput {
  resourceIds?: string[];
  folderIds?: string[];
}
