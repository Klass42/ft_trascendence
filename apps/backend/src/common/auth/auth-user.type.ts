export type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

/**
 * Identity of the authenticated user. MUST match the frontend contract in
 * apps/frontend/src/lib/api/types.ts (8 fields). Additive extensions (adding
 * optional/required fields) are allowed — never remove fields.
 */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  role: GlobalRole;
  emailNotificationsEnabled: boolean;
  preferredLanguage: string;
}