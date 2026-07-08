/**
 * API Module
 * 
 * Re-exports all API-related functionality for easy imports:
 * 
 *   import { apiClient, useAuth, ApiError } from '@/lib/api';
 */

// Client
export { apiClient, ApiClient } from './client';

// Auth
export { AuthProvider, useAuth, useHasRole, useIsAdmin, useIsTeacher } from './auth-context';

// Token storage (usually not needed directly, but exported for testing)
export {
  tokenStorage,
  createTokenStorage,
  LocalStorageTokenStorage,
  DevTokenStorage,
  type TokenStorage,
} from './token-storage';

// Hooks
export {
  useCourses,
  useCourseDetail,
  useSections,
  useLesson,
  useLessonById,
  useProgress,
  useCompleteLesson,
  useEnroll,
  useCompletedLessons,
  useMyProgress,
} from './hooks';

// Types
export {
  ApiError,
  type ApiErrorResponse,
  type AuthUser,
  type AuthTokens,
  type GlobalRole,
  type RequestOptions,
  type UploadOptions,
  type PaginatedResponse,
  type PaginationParams,
  type MyProgressItem,
} from './types';
