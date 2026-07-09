export type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

/**
 * Identity of the authenticated user. MUST match the frontend contract in
 * apps/frontend/src/lib/api/types.ts (6 fields). Do not reduce fields without
 * coordinating with the frontend.
 */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  role: GlobalRole;
}