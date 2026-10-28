import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { AppService } from '../../app.service';
import type { PrismaService } from '@/prisma/prisma.service';

const config = { getOrThrow: () => 'test-access-secret', get: () => undefined } as unknown as ConfigService;
const jwt = new JwtService({});

function setup(opts: { user?: Record<string, unknown> | null; org?: Record<string, unknown> | null } = {}) {
  const prisma = {
    organization: { findUnique: jest.fn(async () => opts.org ?? null) },
    user: { findFirst: jest.fn(async () => opts.user ?? null), findMany: jest.fn(async () => [{ id: 'admin1' }]) },
    auditLog: { create: jest.fn() },
  };
  const notifications = { emitMany: jest.fn() };
  const service = new AuthService(prisma as unknown as PrismaService, jwt, config, notifications as never);
  return { prisma, notifications, service };
}

const user = { id: 'u2', organizationId: 'org1', passwordHash: 'h', name: 'Sam', email: 'student@demo' };

describe('Forgot password (#110)', () => {
  it('answers the same for unknown accounts and does nothing else', async () => {
    const { service, prisma, notifications } = setup({ user: null });
    await expect(service.requestPasswordReset('demo', 'nobody@demo')).resolves.toEqual({ requested: true });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(notifications.emitMany).not.toHaveBeenCalled();
  });

  it('audits and notifies the organization admins for an existing account', async () => {
    const { service, prisma, notifications } = setup({ user });
    await expect(service.requestPasswordReset('demo', 'Student@demo')).resolves.toEqual({ requested: true });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'PASSWORD_RESET_REQUESTED', targetUserId: 'u2' }) });
    expect(notifications.emitMany).toHaveBeenCalledWith(expect.any(Function), expect.anything(), expect.objectContaining({ link: '/admin/users/u2' }), { organizationId: 'org1', actorId: 'u2' });
  });
});

describe('Registration messages and enumeration (#110)', () => {
  const dto = { organizationSlug: 'nope', email: 'a@demo', name: 'A', password: 'Abcdefg1' };

  it('unknown or suspended organization → 400 with a registration message', async () => {
    await expect(setup({ org: null }).service.register(dto)).rejects.toThrow(BadRequestException);
    await expect(setup({ org: { id: 'o', status: 'SUSPENDED' } }).service.register(dto)).rejects.toThrow(/organización activa/);
  });

  it('duplicate email → generic 409', async () => {
    const promise = setup({ org: { id: 'o', status: 'ACTIVE' }, user: { id: 'x' } }).service.register(dto);
    await expect(promise).rejects.toThrow(ConflictException);
    await expect(setup({ org: { id: 'o', status: 'ACTIVE' }, user: { id: 'x' } }).service.register(dto)).rejects.toThrow(/No se ha podido crear la cuenta/);
  });

  it('resolve-organization hides status and treats suspended as unknown', async () => {
    await expect(setup({ org: { name: 'S', slug: 's', logoUrl: null, primaryColor: null, status: 'SUSPENDED' } }).service.resolveOrganization('s')).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ org: null }).service.resolveOrganization('s')).rejects.toBeInstanceOf(NotFoundException);
    const branding = await setup({ org: { name: 'S', slug: 's', logoUrl: null, primaryColor: null, status: 'ACTIVE' } }).service.resolveOrganization('s');
    expect(branding).toEqual({ name: 'S', slug: 's', logoUrl: null, primaryColor: null });
  });
});

describe('Public /health (#110)', () => {
  it('does not expose uptime or memory', async () => {
    const app = new AppService({ $queryRaw: jest.fn(async () => 1) } as unknown as PrismaService);
    const health = await app.getHealth();
    expect(health).toEqual({ status: 'ok', database: 'up' });
  });
});
