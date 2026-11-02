export interface OrgDTO {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberDTO {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  bio: string | null;
  onlineAt: string | null;
  emailVerifiedAt: string | null;
  /** #134: set when removed from the organization (no login, history kept). */
  deactivatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
