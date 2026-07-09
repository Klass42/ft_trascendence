import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthUser } from './auth-user.type';

/**
 * Pre-login dev guard: resolves the `x-dev-user` header (a seeded userId)
 * to a User row and sets `req.user` as the 6-field AuthUser.
 *
 * - The frontend sends this header automatically when VITE_DEV_USER_ID is set
 *   (apps/frontend/src/lib/api/client.ts).
 * - BLOCKED in production (NODE_ENV === 'production') so the dev bypass can
 *   never leak to a graded deploy.
 * - Replaced in practice by JwtAuthGuard once Epic 2 ships login, but kept as
 *   the dev-valve: tests/manual QA can still impersonate a seeded user by
 *   sending the header, without issuing JWTs.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'production') return false;

    const req = ctx.switchToHttp().getRequest<{
      headers?: Record<string, string | undefined>;
      user?: AuthUser;
    }>();

    const devUserId = req.headers?.['x-dev-user'];
    if (!devUserId) {
      throw new UnauthorizedException('Missing x-dev-user header (dev-only guard)');
    }

    const user = await this.prisma.user.findUnique({ where: { id: devUserId } });
    if (!user) {
      throw new UnauthorizedException(`Dev user ${devUserId} not found`);
    }

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      role: user.role,
    };
    return true;
  }
}
