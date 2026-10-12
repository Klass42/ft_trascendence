import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppAuthGuard } from '../app-auth.guard';
import { IS_PUBLIC_KEY } from '../public.decorator';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { DevAuthGuard } from '../dev-auth.guard';

const mkCtx = (
  headers: Record<string, string | undefined> = {},
  overrides: { path?: string; organizationId?: string } = {},
) => {
  const req = {
    headers,
    path: overrides.path ?? '/api/courses',
    // Successful JWT/dev guards populate this field. Keeping it in the context
    // lets this unit test exercise the composite guard's tenant assertion.
    user: { organizationId: overrides.organizationId ?? 'org-klass-0001' },
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({ name: 'testHandler' }),
    getClass: () => ({ name: 'TestController' }),
  } as unknown as ExecutionContext;
};

const mkReflector = (isPublic: boolean) => ({
  getAllAndOverride: jest.fn((_key: string, _targets: unknown[]) => isPublic),
} as unknown as Reflector);

const jwtOk = { canActivate: jest.fn(async () => true) } as unknown as JwtAuthGuard;
const jwtFail = { canActivate: jest.fn(async () => { throw new UnauthorizedException(); }) } as unknown as JwtAuthGuard;
const devOk = { canActivate: jest.fn(async () => true) } as unknown as DevAuthGuard;
const devFail = { canActivate: jest.fn(async () => { throw new UnauthorizedException(); }) } as unknown as DevAuthGuard;

describe('AppAuthGuard', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
  });
  afterAll(() => { process.env.NODE_ENV = 'test'; });

  it('allows when @Public() is set', async () => {
    const guard = new AppAuthGuard(mkReflector(true), jwtFail, devFail);
    expect(await guard.canActivate(mkCtx())).toBe(true);
  });

  it('allows when JWT validates successfully', async () => {
    const guard = new AppAuthGuard(mkReflector(false), jwtOk, devFail);
    expect(await guard.canActivate(mkCtx({ authorization: 'Bearer valid' }))).toBe(true);
  });

  it('falls back to DevAuthGuard in non-production when JWT fails', async () => {
    const guard = new AppAuthGuard(mkReflector(false), jwtFail, devOk);
    expect(await guard.canActivate(mkCtx({ 'x-dev-user': 'user-student-0001' }))).toBe(true);
    expect(devOk.canActivate).toHaveBeenCalled();
  });

  it('throws 401 when both JWT and DevAuthGuard fail in dev', async () => {
    const guard = new AppAuthGuard(mkReflector(false), jwtFail, devFail);
    await expect(guard.canActivate(mkCtx())).rejects.toThrow(UnauthorizedException);
  });

  it('does NOT fall back to DevAuthGuard in production', async () => {
    process.env.NODE_ENV = 'production';
    const guard = new AppAuthGuard(mkReflector(false), jwtFail, devOk);
    await expect(guard.canActivate(mkCtx({ 'x-dev-user': 'user-student-0001' }))).rejects.toThrow(UnauthorizedException);
    expect(devOk.canActivate).not.toHaveBeenCalled();
    process.env.NODE_ENV = 'development';
  });

  it('lets a platform account read its own notifications', async () => {
    const guard = new AppAuthGuard(mkReflector(false), jwtOk, devFail);
    await expect(guard.canActivate(mkCtx(
      { authorization: 'Bearer valid' },
      { path: '/notifications', organizationId: '' },
    ))).resolves.toBe(true);
  });

  it('rejects a platform account on a tenant route', async () => {
    const guard = new AppAuthGuard(mkReflector(false), jwtOk, devFail);
    await expect(guard.canActivate(mkCtx(
      { authorization: 'Bearer valid' },
      { path: '/courses', organizationId: '' },
    ))).rejects.toThrow(ForbiddenException);
  });
});
