import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationsService } from '../organizations.service';
import type { PrismaService } from '@/prisma/prisma.service';

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
  }) as unknown as PrismaService;

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: ReturnType<typeof mkPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mkPrisma();
    service = new OrganizationsService(prisma);
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
});
