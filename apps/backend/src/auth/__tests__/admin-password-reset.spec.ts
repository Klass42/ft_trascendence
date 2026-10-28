import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from '../auth.service';
import type { PrismaService } from '@/prisma/prisma.service';

const config = { getOrThrow: () => 'test-access-secret' } as unknown as ConfigService;
const jwt = new JwtService({});

function setup(user: Record<string, unknown> | null) {
  const prisma = {
    user: { findUnique: jest.fn(async () => user), update: jest.fn() },
    session: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
    organizationInvitation: { findUnique: jest.fn() },
  };
  const notifications = { emitMany: jest.fn() };
  const service = new AuthService(prisma as unknown as PrismaService, jwt, config, notifications as never);
  return { prisma, notifications, service };
}

const target = { id: 'u2', organizationId: 'org1', passwordHash: 'hash-1', email: 'student@demo', name: 'Sam' };
const actor = { userId: 'u1', organizationId: 'org1' };

describe('Admin password reset (#108)', () => {
  it('issues a link, audits it and notifies the user', async () => {
    const { service, prisma, notifications } = setup(target);
    const result = await service.issueAdminPasswordReset('u2', actor);
    expect(result.resetToken).toEqual(expect.any(String));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'PASSWORD_RESET_ISSUED', targetUserId: 'u2' }) });
    expect(notifications.emitMany).toHaveBeenCalled();
  });

  it('rejects users of another organization and self-reset', async () => {
    await expect(setup({ ...target, organizationId: 'other' }).service.issueAdminPasswordReset('u2', actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup(target).service.issueAdminPasswordReset('u1', actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resets the password once, revokes sessions; the link dies after use', async () => {
    const { service, prisma } = setup(target);
    const { resetToken } = await service.issueAdminPasswordReset('u2', actor);
    await expect(service.resetPassword(resetToken, 'Nueva1234')).resolves.toEqual({ reset: true });
    const newHash = (prisma.user.update.mock.calls[0] as any)[0].data.passwordHash as string;
    expect(await argon2.verify(newHash, 'Nueva1234')).toBe(true);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u2' } });

    const after = setup({ ...target, passwordHash: newHash });
    await expect(after.service.resetPassword(resetToken, 'Otra12345')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects garbage and tokens of another purpose', async () => {
    const { service } = setup(target);
    await expect(service.resetPassword('garbage', 'Nueva1234')).rejects.toBeInstanceOf(BadRequestException);
    const other = jwt.sign({ sub: 'u2', purpose: 'email-verify' }, { secret: 'test-access-secret' });
    await expect(service.resetPassword(other, 'Nueva1234')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GET /auth/invitations/:token status codes (#108)', () => {
  it('404 for unknown, 410 for expired/revoked', async () => {
    const { service, prisma } = setup(null);
    prisma.organizationInvitation.findUnique.mockResolvedValueOnce(null);
    await expect(service.invitation('tok')).rejects.toBeInstanceOf(NotFoundException);
    prisma.organizationInvitation.findUnique.mockResolvedValueOnce({ status: 'REVOKED', expiresAt: new Date(Date.now() + 1e6), organization: { status: 'ACTIVE' } });
    await expect(service.invitation('tok')).rejects.toBeInstanceOf(GoneException);
    prisma.organizationInvitation.findUnique.mockResolvedValueOnce({ status: 'PENDING', expiresAt: new Date(Date.now() - 1000), organization: { status: 'ACTIVE' } });
    await expect(service.invitation('tok')).rejects.toBeInstanceOf(GoneException);
  });
});
