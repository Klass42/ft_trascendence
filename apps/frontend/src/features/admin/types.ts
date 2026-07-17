import type { GlobalRole } from '@/lib/api/types';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: GlobalRole;
  bio: string | null;
  onlineAt: string | null;
  emailVerifiedAt: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: GlobalRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: GlobalRole;
  bio?: string;
}
