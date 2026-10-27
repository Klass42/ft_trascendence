import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from './auth-user.type';

/** Tenant id is exclusively derived from the authenticated user. */
export function tenantId(user: AuthUser): string {
  if (!user.organizationId) throw new ForbiddenException('Necesitas pertenecer a una organización.');
  return user.organizationId;
}
