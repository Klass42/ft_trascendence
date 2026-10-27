import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DevAuthGuard } from './dev-auth.guard';

/**
 * Global composite guard (registered as APP_GUARD).
 *
 * 1. @Public() → allow.
 * 2. JwtAuthGuard → validate Bearer token.
 * 3. If JWT fails AND NODE_ENV !== 'production' → DevAuthGuard (x-dev-user header).
 * 4. Otherwise → 401.
 *
 * In production only JWT is accepted; the dev bypass never activates.
 */
@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly devAuthGuard: DevAuthGuard,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    let allowed = false;
    try {
      allowed = await (this.jwtAuthGuard.canActivate(ctx) as Promise<boolean>);
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException();
      }
      try {
        allowed = await this.devAuthGuard.canActivate(ctx);
      } catch {
        throw new UnauthorizedException();
      }
    }

    // Kept outside the auth catch: a missing tenant is 403, not a failed login.
    this.assertTenantRoute(ctx);
    return allowed;
  }
  private assertTenantRoute(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<{ path?: string; user?: { organizationId: string } }>();
    const path = req.path ?? '';
    // Notifications belong to the user, not a tenant. Platform accounts
    // (no organizationId) must be able to read the deletion requests sent to them.
    const openToPlatformAccount =
      path.startsWith('/platform') ||
      path.startsWith('/auth') ||
      path.startsWith('/notifications');
    if (!openToPlatformAccount && !req.user?.organizationId) {
      throw new ForbiddenException('Necesitas pertenecer a una organización.');
    }
  }
}
