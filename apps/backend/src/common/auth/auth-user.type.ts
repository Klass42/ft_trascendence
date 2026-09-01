export type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type PlatformRole = 'NONE' | 'SUPERADMIN';

/**
 * Identity of the authenticated user. MUST match the frontend contract in
 * apps/frontend/src/lib/api/types.ts (8 fields). Additive extensions (adding
 * fields in both layers in the same PR) are allowed — never remove fields.
 */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  /** Empty only for a platform account; AppAuthGuard rejects it on tenant routes. */
  organizationId: string;
  role: GlobalRole;
  platformRole?: PlatformRole;
  emailNotificationsEnabled: boolean;
  preferredLanguage: string;
}
