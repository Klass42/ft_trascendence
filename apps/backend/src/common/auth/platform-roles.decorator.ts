import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from './auth-user.type';

export const PLATFORM_ROLES_KEY = 'platform_roles';
export const PlatformRoles = (...roles: PlatformRole[]) => SetMetadata(PLATFORM_ROLES_KEY, roles);
