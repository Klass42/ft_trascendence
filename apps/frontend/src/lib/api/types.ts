/**
 * API Types
 * Shared types for the API client and auth system
 */

// =============================================================================
// Auth Types (mirrors backend's AuthUser from common/auth)
// =============================================================================

export type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  role: GlobalRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// =============================================================================
// API Error Types
// =============================================================================

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: string[]
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(status: number, data: ApiErrorResponse): ApiError {
    const message = Array.isArray(data.message)
      ? data.message[0]
      : data.message;
    const errors = Array.isArray(data.message) ? data.message : undefined;
    return new ApiError(status, message, errors);
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400 && !!this.errors?.length;
  }
}

// =============================================================================
// API Client Types
// =============================================================================

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Skip adding auth header (for public endpoints like /auth/login) */
  skipAuth?: boolean;
}

export interface UploadOptions extends RequestOptions {
  /** Additional form fields to send with the file */
  fields?: Record<string, string>;
  /** Progress callback (0-100) */
  onProgress?: (percent: number) => void;
}

// =============================================================================
// Pagination Types (for list endpoints)
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// DTOs (api response shapes)
export type {
  CourseDTO,
  SectionDTO,
  LessonDTO,
  FileDTO,
  LessonAttachmentDTO,
  EnrollmentDTO,
  ProgressDTO,
  CompleteLessonDTO,
  MyProgressItem,
  CourseStatus,
  CourseRole,
} from './types/course';

export type {
  AssignmentDTO,
  SubmissionDTO,
  SubmissionFileDTO,
  SubmissionAuthorDTO,
  SubmissionStatus,
  CreateAssignmentInput,
  CreateSubmissionInput,
} from './types/assignment';

export type {
  GradebookDTO,
  GradebookAssignmentDTO,
  GradebookCellDTO,
  GradebookRowDTO,
  MyGradeDTO,
  GradeSubmissionInput,
} from './types/gradebook';

export type {
  ForumAuthorDTO,
  ForumThreadListItemDTO,
  ForumThreadDTO,
  ForumPostDTO,
  CreateThreadInput,
  CreatePostInput,
} from './types/forum';

export type {
  NotificationType,
  NotificationDTO,
  NotificationsListDTO,
} from './types/notification';
