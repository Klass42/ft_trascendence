import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { AuthUser } from './auth-user.type';

/**
 * Raw factory — the testable surface of `@CurrentUser()`. Pulled out so unit
 * tests can call it directly (Nest's `createParamDecorator` returns a decorator
 * factory, not the factory result, so `CurrentUser(...)` can't be called in a
 * test to get the `AuthUser`).
 */
export const currentUserFactory = (_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
  if (!req.user) {
    // 500, not 401: this is a programmer error (route missing @UseGuards), not
    // a caller auth problem. Fails safe (no data leak) and surfaces clearly in
    // observability dashboards as a misconfigured route.
    throw new InternalServerErrorException(
      '@CurrentUser() used without an auth guard — add @UseGuards to this route',
    );
  }
  return req.user;
};

/**
 * Param decorator that yields the authenticated AuthUser on `req.user`.
 * Throws (500) if no auth guard populated `req.user` — a programming error,
 * not a caller auth problem. Always pair with a guard (DevAuthGuard /
 * JwtAuthGuard).
 */
export const CurrentUser = createParamDecorator(currentUserFactory);
