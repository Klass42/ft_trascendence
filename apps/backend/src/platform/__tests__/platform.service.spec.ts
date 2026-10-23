import { ConflictException, NotFoundException } from '@nestjs/common';
import { PlatformService } from '../platform.service';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const ACTOR_ID = 'user-superadmin-0001';

const mockOrg = {
  id: ORG_ID,
  name: 'Klass Academy',
  slug: 'klass',
  plan: 'STARTER',
  maxUsers: null,
  maxCourses: null,
  maxStorageMb: null,
  status: 'ACTIVE',
};

const noOpFiles = { deleteOrganizationObjects: jest.fn(async () => undefined) } as never;

function buildFake() {
  const organization = {
    create: jest.fn(async ({ data }: any) => ({ ...mockOrg, ...data, id: ORG_ID })),
    findMany: jest.fn(),
    findUnique: jest.fn(async () => mockOrg),
    update: jest.fn(async ({ where, data }: any) => ({ ...mockOrg, id: where.id, ...data })),
    delete: jest.fn(async () => mockOrg),
  };
  const learningResource = {
    deleteMany: jest.fn(async () => ({ count: 0 })),
  };
  const file = { findMany: jest.fn(async () => [{ objectKey: `${ORG_ID}/object-a` }]) };
  const organizationInvitation = {
    create: jest.fn(async ({ data }: any) => ({ id: 'invite-1', expiresAt: data.expiresAt, ...data })),
    upsert: jest.fn(async ({ create }: any) => ({ id: 'invite-1', ...create })),
  };
  const auditLog = { create: jest.fn() };
  const user = { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) };
  const session = { deleteMany: jest.fn() };
  const transaction = jest.fn(async (callback: any) =>
    callback({ organization, organizationInvitation, auditLog, user, session, learningResource, file }),
  );
  const prisma = {
    organization,
    organizationInvitation,
    auditLog,
    user,
    session,
    learningResource,
    file,
    $transaction: transaction,
  } as unknown as PrismaService;
  const files = { deleteOrganizationObjects: jest.fn(async () => undefined) };

  return { prisma, organization, organizationInvitation, auditLog, user, session, learningResource, file, files };
}

describe('PlatformService', () => {
  describe('createOrganization', () => {
    it('creates the org with the requested plan/limits and returns an invitation token', async () => {
      const { prisma, organization } = buildFake();
      const service = new PlatformService(prisma, noOpFiles);

      const result = await service.createOrganization(
        {
          name: 'Klass Academy',
          slug: 'klass',
          adminEmail: 'admin@klass.demo',
          adminName: 'Ada Admin',
          plan: 'GROWTH',
          maxUsers: 500,
          maxCourses: 50,
        } as any,
        ACTOR_ID,
      );

      expect(organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'GROWTH', maxUsers: 500, maxCourses: 50 }),
        }),
      );
      expect(result.invitationToken).toEqual(expect.any(String));
      expect(result.organization.slug).toBe('klass');
    });

    it('rethrows a slug conflict as ConflictException', async () => {
      const { prisma, organization } = buildFake();
      organization.create.mockRejectedValueOnce({ code: 'P2002' });
      const service = new PlatformService(prisma, noOpFiles);

      await expect(
        service.createOrganization(
          { name: 'Dup', slug: 'klass', adminEmail: 'a@b.test', adminName: 'A' } as any,
          ACTOR_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateOrganization', () => {
    it('forwards plan/limit changes straight to Prisma and logs the change', async () => {
      const { prisma, organization, auditLog } = buildFake();
      const service = new PlatformService(prisma, noOpFiles);

      const result = await service.updateOrganization(
        ORG_ID,
        { plan: 'ENTERPRISE', maxUsers: null },
        ACTOR_ID,
      );

      expect(organization.update).toHaveBeenCalledWith({
        where: { id: ORG_ID },
        data: { plan: 'ENTERPRISE', maxUsers: null },
      });
      expect(result.plan).toBe('ENTERPRISE');
      expect(auditLog.create).toHaveBeenCalled();
    });
  });

  describe('suspend', () => {
    it('sets status to SUSPENDED and revokes active sessions', async () => {
      const { prisma, organization, user, session, auditLog } = buildFake();
      (user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
      const service = new PlatformService(prisma, noOpFiles);

      await service.suspend(ORG_ID, ACTOR_ID);

      expect(organization.update).toHaveBeenCalledWith({ where: { id: ORG_ID }, data: { status: 'SUSPENDED' } });
      expect(session.deleteMany).toHaveBeenCalledWith({ where: { userId: { in: ['user-1', 'user-2'] } } });
      expect(auditLog.create).toHaveBeenCalled();
    });
  });

  describe('inviteAdmin', () => {
    it('throws NotFoundException when the organization does not exist', async () => {
      const { prisma, organization } = buildFake();
      (organization.findUnique as jest.Mock).mockResolvedValue(null);
      const service = new PlatformService(prisma, noOpFiles);

      await expect(service.inviteAdmin(ORG_ID, { email: 'new-admin@klass.demo' } as any, ACTOR_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when a user with that email already belongs to the org', async () => {
      const { prisma, user } = buildFake();
      (user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-existing' });
      const service = new PlatformService(prisma, noOpFiles);

      await expect(service.inviteAdmin(ORG_ID, { email: 'admin@klass.demo' } as any, ACTOR_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates an ADMIN invitation and returns a one-time token', async () => {
      const { prisma, organizationInvitation, auditLog } = buildFake();
      const service = new PlatformService(prisma, noOpFiles);

      const result = await service.inviteAdmin(ORG_ID, { email: 'recovery-admin@klass.demo' } as any, ACTOR_ID);

      expect(organizationInvitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId_email: { organizationId: ORG_ID, email: 'recovery-admin@klass.demo' } },
          create: expect.objectContaining({ role: 'ADMIN', organizationId: ORG_ID }),
        }),
      );
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'ORGANIZATION_ADMIN_RECOVERY_INVITED' }) }),
      );
      expect(result.invitationToken).toEqual(expect.any(String));
      expect(result.role).toBe('ADMIN');
    });
  });

  describe('deleteOrganization', () => {
    it('hard-deletes the organization and writes ORGANIZATION_DELETED', async () => {
      const { prisma, organization, auditLog, learningResource, file, files } = buildFake();
      const service = new PlatformService(prisma, files as never);

      await service.deleteOrganization(ORG_ID, ACTOR_ID);

      expect(organization.findUnique).toHaveBeenCalledWith({ where: { id: ORG_ID } });
      expect(auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: ACTOR_ID,
          action: 'ORGANIZATION_DELETED',
          organizationId: ORG_ID,
          metadata: { name: mockOrg.name, slug: mockOrg.slug },
        }),
      });
      expect(learningResource.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID },
      });
      expect(file.findMany).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID },
        select: { objectKey: true },
      });
      expect(organization.delete).toHaveBeenCalledWith({ where: { id: ORG_ID } });
      expect(files.deleteOrganizationObjects).toHaveBeenCalledWith(ORG_ID, [`${ORG_ID}/object-a`]);
      expect(organization.delete.mock.invocationCallOrder[0])
        .toBeLessThan(files.deleteOrganizationObjects.mock.invocationCallOrder[0]);
      expect(auditLog.create.mock.invocationCallOrder[0]).toBeLessThan(
        learningResource.deleteMany.mock.invocationCallOrder[0],
      );
      expect(learningResource.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        organization.delete.mock.invocationCallOrder[0],
      );
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      const { prisma, organization, auditLog, learningResource, files } = buildFake();
      (organization.findUnique as jest.Mock).mockResolvedValue(null);
      const service = new PlatformService(prisma, files as never);

      await expect(service.deleteOrganization('ghost', ACTOR_ID)).rejects.toThrow(NotFoundException);
      expect(organization.delete).not.toHaveBeenCalled();
      expect(learningResource.deleteMany).not.toHaveBeenCalled();
      expect(auditLog.create).not.toHaveBeenCalled();
    });
  });
});
