import { SetMetadata } from '@nestjs/common';
import type { GlobalRole } from './auth-user.type';

/**
 * Restrict a handler to the given global roles. Example:
 *   @UseGuards(DevAuthGuard, RolesGuard)
 *   @Roles('ADMIN')
 * Combine with an auth guard that sets `req.user`. Multiple roles allowed:
 *   @Roles('ADMIN', 'TEACHER')
 */
export const Roles = (...roles: GlobalRole[]) => SetMetadata('roles', roles);
export const ROLES_KEY = 'roles';
