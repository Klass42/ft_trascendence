import type { PrismaService } from '@/prisma/prisma.service';
import { JwtStrategy, JwtPayload } from '../jwt.strategy';

const userRow = {
  id: 'user-x', email: 'x@b.co', name: 'X', avatarUrl: null,
  organizationId: 'org-x', role: 'TEACHER' as const,
};

const prisma = {
  user: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'user-x' ? userRow : null,
    ),
  },
  getOrThrow: jest.fn(() => 'test-secret'),
  get: jest.fn(() => undefined),
} as unknown as PrismaService;

describe('JwtStrategy.validate()', () => {
  it('maps the Prisma user row to AuthUser (6 fields)', async () => {
    const strategy = new JwtStrategy(prisma as any, prisma as any);
    const out = await strategy.validate({ sub: 'user-x' } as JwtPayload);
    expect(out).toEqual({
      userId: 'user-x', email: 'x@b.co', name: 'X', avatarUrl: null,
      organizationId: 'org-x', role: 'TEACHER',
    });
  });

  it('throws when the user does not exist', async () => {
    const strategy = new JwtStrategy(prisma as any, prisma as any);
    await expect(strategy.validate({ sub: 'no-one' } as JwtPayload)).rejects.toThrow();
  });
});
