import type { GlobalRole } from '@/lib/api';

export type FriendRelation = 'NONE' | 'FRIEND' | 'PENDING_SENT' | 'PENDING_RECEIVED';

/** Response of GET /users/:id/profile (public fields only; email for staff viewers). */
export interface PublicProfileDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: GlobalRole;
  bio: string | null;
  email?: string;
  memberSince: string;
  sharedCourses: { id: string; name: string }[];
  relation: FriendRelation;
  friendshipId: string | null;
}
