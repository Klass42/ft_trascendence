import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { OrganizationsService } from '../organizations.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { NotificationsService } from '@/notifications/notifications.service';

const ORG_ID = 'org-klass-0001';
const OTHER_ORG = 'org-other-0001';

const mockOrg = {
  id: ORG_ID,
  name: 'Klass Academy',
  slug: 'klass',
  logoUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMembers = [
  {
    id: 'user-admin-0001',
    email: 'admin@demo',
    name: 'Ada Admin',
    avatarUrl: null,
    role: 'ADMIN' as const,
    bio: null,
    onlineAt: null,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-student-0001',
    email: 'student@demo',
    name: 'Sam Student',
    avatarUrl: null,
    role: 'STUDENT' as const,
    bio: null,
    onlineAt: null,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mkPrisma = () =>
  ({
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  }) as unknown as PrismaService;

const actor = {
  userId: 'user-admin-0001',
  name: 'Ada Admin',
  email: 'admin@demo',
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: ReturnType<typeof mkPrisma>;
  let notifications: { emit: jest.Mock; emitMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mkPrisma();
    notifications = {
      emit: jest.fn(async () => ({ id: 'notif-1' })),
      emitMany: jest.fn(async () => undefined),
    };
    service = new OrganizationsService(
      prisma,
      notifications as unknown as NotificationsService,
    );
  });

  describe('findMyOrganization', () => {
    it('returns the org when found', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      const result = await service.findMyOrganization(ORG_ID);
      expect(result).toEqual(mockOrg);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { id: ORG_ID } });
    });

    it('throws NotFoundException when org does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findMyOrganization('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the org when caller belongs to it', async () => {
      (prisma.organization.update as jest.Mock).mockResolvedValue({ ...mockOrg, name: 'New Name' });
      const result = await service.update(ORG_ID, { name: 'New Name' }, ORG_ID);
      expect(result.name).toBe('New Name');
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: ORG_ID },
        data: { name: 'New Name' },
      });
    });

    it('throws ForbiddenException when id !== callerOrgId', async () => {
      await expect(
        service.update(OTHER_ORG, { name: 'Hack' }, ORG_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('notifies organization members except the acting admin', async () => {
      (prisma.organization.update as jest.Mock).mockResolvedValue({ ...mockOrg, name: 'New Name' });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: actor.userId }, { id: 'user-student-0001' }]);
      let recipients: string[] = [];
      notifications.emitMany.mockImplementation(async (...args: any[]) => {
        const loader = args[0];
        const resolved = typeof loader === 'function' ? await loader() : loader;
        recipients = resolved.filter((id: string) => id !== actor.userId);
      });

      await service.update(ORG_ID, { name: 'New Name' }, ORG_ID, actor.userId);

      expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { organizationId: ORG_ID }, select: { id: true } });
      expect(recipients).toEqual(['user-student-0001']);
      expect(notifications.emitMany).toHaveBeenCalledWith(
        expect.any(Function),
        NotificationType.ORGANIZATION_CHANGED,
        expect.objectContaining({ title: 'La organización se ha actualizado' }),
        { organizationId: ORG_ID, actorId: actor.userId },
      );
    });
  });

  describe('findMembers', () => {
    it('returns members without passwordHash', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockMembers);
      const result = await service.findMembers(ORG_ID, ORG_ID);
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('uses select to exclude passwordHash at query level', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockMembers);
      await service.findMembers(ORG_ID, ORG_ID);
      const args = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(args.select).toBeDefined();
      expect(args.select.passwordHash).toBeUndefined();
    });

    it('throws ForbiddenException when org mismatch', async () => {
      await expect(service.findMembers(OTHER_ORG, ORG_ID)).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('deletes the user when caller is admin of same org', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-student-0001', organizationId: ORG_ID });
      (prisma.user.delete as jest.Mock).mockResolvedValue({});
      await service.removeMember(ORG_ID, 'user-student-0001', ORG_ID, 'user-admin-0001');
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-student-0001' } });
    });

    it('throws ForbiddenException when org mismatch', async () => {
      await expect(
        service.removeMember(OTHER_ORG, 'user-student-0001', ORG_ID, 'user-admin-0001'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when target user belongs to another org', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-x', organizationId: OTHER_ORG });
      await expect(
        service.removeMember(ORG_ID, 'user-x', ORG_ID, 'user-admin-0001'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when target user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.removeMember(ORG_ID, 'ghost', ORG_ID, 'user-admin-0001'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on self-deletion', async () => {
      await expect(
        service.removeMember(ORG_ID, 'user-admin-0001', ORG_ID, 'user-admin-0001'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('requestDeletion', () => {
    const title = 'Solicitud de borrado: Klass Academy';
    const link = `/platform/organizations/${ORG_ID}`;

    it('notifies every superadmin and writes an audit log', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'sa-1' }, { id: 'sa-2' }]);
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.requestDeletion(ORG_ID, actor);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { platformRole: 'SUPERADMIN' },
        select: { id: true },
      });
      expect(notifications.emit).toHaveBeenCalledTimes(2);
      expect(notifications.emit).toHaveBeenCalledWith('sa-1', NotificationType.SYSTEM, {
        title,
        body: 'Ada Admin (admin@demo) pide borrar la organización «Klass Academy» (klass).',
        link,
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: actor.userId,
          action: 'ORGANIZATION_DELETION_REQUESTED',
          organizationId: ORG_ID,
          metadata: { notified: 2 },
        }),
      });
      expect(result).toEqual({ notified: 2, alreadyPending: false });
    });

    it('skips superadmins who already have an unread request', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'sa-1' }, { id: 'sa-2' }]);
      (prisma.notification.findFirst as jest.Mock).mockImplementation(
        async ({ where }: { where: { userId: string } }) =>
          where.userId === 'sa-1' ? { id: 'existing' } : null,
      );

      const result = await service.requestDeletion(ORG_ID, actor);

      expect(notifications.emit).toHaveBeenCalledTimes(1);
      expect(notifications.emit).toHaveBeenCalledWith(
        'sa-2',
        NotificationType.SYSTEM,
        expect.objectContaining({ link }),
      );
      expect(result).toEqual({ notified: 1, alreadyPending: false });
    });

    it('returns alreadyPending without a second audit log when every request is unread', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'sa-1' }]);
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      const result = await service.requestDeletion(ORG_ID, actor);

      expect(notifications.emit).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(result).toEqual({ notified: 0, alreadyPending: true });
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.requestDeletion(ORG_ID, actor)).rejects.toThrow(NotFoundException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(notifications.emit).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException when there is no superadmin', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.requestDeletion(ORG_ID, actor)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(notifications.emit).not.toHaveBeenCalled();
    });
  });
});
