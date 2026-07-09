import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
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

    try {
      return await (this.jwtAuthGuard.canActivate(ctx) as Promise<boolean>);
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        try {
          return await this.devAuthGuard.canActivate(ctx);
        } catch {
          throw new UnauthorizedException();
        }
      }
      throw new UnauthorizedException();
    }
  }
}
