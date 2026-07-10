import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../roles.decorator';
import { RolesGuard } from '../roles.guard';
import type { AuthUser } from '../auth-user.type';

const someHandler = function handler() {};

const mkCtx = (role: AuthUser['role'] | undefined) =>
  ({
    getHandler: () => someHandler,
    getClass: () => someHandler,
    switchToHttp: () => ({
      getRequest: () => (role ? {
        user: {
          userId: 'u', email: 'a@b.co', name: 'A',
          avatarUrl: null, organizationId: 'org', role,
        } as AuthUser,
      } : {}),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  beforeEach(() => {
    // Clear metadata between tests so each test sets its own.
    Reflect.defineMetadata('roles', undefined, someHandler);
  });

  it('allows when no @Roles metadata (auth-only)', async () => {
    const guard = new RolesGuard(new Reflector());
    expect(await guard.canActivate(mkCtx('STUDENT'))).toBe(true);
  });

  it('allows when user role is in the list', async () => {
    Reflect.defineMetadata('roles', ['ADMIN'], someHandler);
    const guard = new RolesGuard(new Reflector());
    expect(await guard.canActivate(mkCtx('ADMIN'))).toBe(true);
  });

  it('denies when user role not in the list', async () => {
    Reflect.defineMetadata('roles', ['ADMIN'], someHandler);
    const guard = new RolesGuard(new Reflector());
    expect(await guard.canActivate(mkCtx('STUDENT'))).toBe(false);
  });

  it('throws when req.user is undefined (auth guard missing)', async () => {
    Reflect.defineMetadata('roles', ['ADMIN'], someHandler);
    const guard = new RolesGuard(new Reflector());
    await expect(() => guard.canActivate(mkCtx(undefined))).toThrow();
  });
});
