/** Input for PATCH /users/me. All fields optional (partial update). */
export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  emailNotificationsEnabled?: boolean;
  preferredLanguage?: string;
}

/** Response of PATCH /users/me — own profile (public fields + private prefs). */
export interface OwnProfileDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  bio: string | null;
  onlineAt: string | null;
  email: string;
  organizationId: string;
  emailNotificationsEnabled: boolean;
  preferredLanguage: string;
}
