/**
 * Forum API DTOs
 *
 * Exact shapes of the backend API responses (Prisma models). See
 * apps/backend/src/forums.
 */

import type { SubjectStaffRole } from './course';

/** Minimal author projection embedded in threads/posts. */
export interface ForumAuthorDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** A thread as returned by the list/search endpoints. */
export interface ForumThreadListItemDTO {
  id: string;
  subjectId: string;
  authorId: string | null;
  title: string;
  pinned: boolean;
  createdAt: string;
  author: ForumAuthorDTO | null;
  _count: { posts: number };
}

/** A post node in a thread's reply tree. */
export interface ForumPostDTO {
  id: string;
  threadId: string;
  authorId: string | null;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: ForumAuthorDTO | null;
  authorRole: SubjectStaffRole | null;
  replies: ForumPostDTO[];
}

/** A single thread with its posts nested into a reply tree. */
export interface ForumThreadDTO {
  id: string;
  subjectId: string;
  authorId: string | null;
  title: string;
  pinned: boolean;
  createdAt: string;
  author: ForumAuthorDTO | null;
  authorRole: SubjectStaffRole | null;
  posts: ForumPostDTO[];
}

// =============================================================================
// Request payloads
// =============================================================================

export interface CreateThreadInput {
  title: string;
  body?: string;
}

export interface CreatePostInput {
  body: string;
  parentId?: string;
}
