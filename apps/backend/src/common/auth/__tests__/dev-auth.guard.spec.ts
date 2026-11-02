import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import { DevAuthGuard } from '../dev-auth.guard';

const userRow = {
  id: 'user-admin-0001', email: 'admin@demo', name: 'Ad',
  avatarUrl: null, organizationId: 'org-klass-0001', role: 'ADMIN' as const,
  emailNotificationsEnabled: true, preferredLanguage: 'es',
};

const mkCtx = (devUserId?: string) => {
  const req = {
    headers: devUserId ? { 'x-dev-user': devUserId } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
};

const prisma = {
  user: {
    findUnique: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        where.id === 'user-admin-0001' ? userRow : null,
    ),
  },
} as unknown as PrismaService;

describe('DevAuthGuard', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });
  afterAll(() => {
    process.env.NODE_ENV = 'test';
  });

  it('loads the user from x-dev-user header and sets req.user', async () => {
    const guard = new DevAuthGuard(prisma);
    const ctx = mkCtx('user-admin-0001');
    expect(await guard.canActivate(ctx)).toBe(true);
    const req = ctx.switchToHttp().getRequest<{ user: unknown }>();
    expect(req.user).toMatchObject({
      userId: 'user-admin-0001', role: 'ADMIN', organizationId: 'org-klass-0001',
    });
  });

  it('#134 rejects a deactivated user', async () => {
    const deactivated = {
      user: { findUnique: jest.fn(async () => ({ id: 'user-admin-0001', deactivatedAt: new Date() })) },
    } as unknown as PrismaService;
    await expect(new DevAuthGuard(deactivated).canActivate(mkCtx('user-admin-0001'))).rejects.toThrow(UnauthorizedException);
  });

  it('throws when header is missing', async () => {
    const guard = new DevAuthGuard(prisma);
    await expect(guard.canActivate(mkCtx(undefined))).rejects.toThrow();
  });

  it('throws when the user does not exist', async () => {
    const guard = new DevAuthGuard(prisma);
    await expect(guard.canActivate(mkCtx('ghost'))).rejects.toThrow();
  });

  it('refuses (false) in production even with a valid header', async () => {
    process.env.NODE_ENV = 'production';
    const guard = new DevAuthGuard(prisma);
    expect(await guard.canActivate(mkCtx('user-admin-0001'))).toBe(false);
    process.env.NODE_ENV = 'development';
  });

  it('maps the user with all 8 AuthUser fields (incl. email, name, avatarUrl)', async () => {
    const guard = new DevAuthGuard(prisma);
    const ctx = mkCtx('user-admin-0001');
    await guard.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest<{ user: any }>();
    expect(req.user).toEqual({
      userId: 'user-admin-0001', email: 'admin@demo', name: 'Ad',
      avatarUrl: null, organizationId: 'org-klass-0001', role: 'ADMIN',
      emailNotificationsEnabled: true, preferredLanguage: 'es',
    });
  });
});
