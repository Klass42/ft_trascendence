import { ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const OTHER_ORG = 'org-other-0001';
const ADMIN_ID = 'user-admin-0001';

const mockUser = {
  id: 'user-student-0001',
  organizationId: ORG_ID,
  email: 'student@demo', name: 'Sam', passwordHash: 'secret',
  avatarUrl: null, bio: null, role: 'STUDENT', onlineAt: null,
  emailVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
};

const mkPrisma = () => ({
  user: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
}) as unknown as PrismaService;

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mkPrisma>;

  beforeEach(() => { jest.clearAllMocks(); prisma = mkPrisma(); service = new UsersService(prisma); process.env.NODE_ENV = 'development'; });
  afterAll(() => { process.env.NODE_ENV = 'test'; });

  describe('findAll', () => {
    it('returns org-scoped users without passwordHash', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      const r = await service.findAll(ORG_ID);
      expect(r).toHaveLength(1);
      const args = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.organizationId).toBe(ORG_ID);
      expect(args.select.passwordHash).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('returns user if belongs to org', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const r = await service.findOne('user-student-0001', ORG_ID);
      expect(r.id).toBe('user-student-0001');
    });
    it('throws NotFoundException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('ghost', ORG_ID)).rejects.toThrow(NotFoundException);
    });
    it('throws ForbiddenException if org mismatch', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.findOne('user-student-0001', OTHER_ORG)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates user with hashed password and default STUDENT role', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      const r = await service.create({ email: 'n@demo', password: 'Password1', name: 'N' }, ORG_ID);
      const cd = (prisma.user.create as jest.Mock).mock.calls[0][0].data;
      expect(cd.passwordHash).not.toBe('Password1');
      expect(cd.role).toBe('STUDENT');
      expect(cd.emailVerifiedAt).toBeInstanceOf(Date);
    });
    it('accepts custom role', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, role: 'TEACHER' });
      await service.create({ email: 'n@demo', password: 'Password1', name: 'N', role: 'TEACHER' }, ORG_ID);
      expect((prisma.user.create as jest.Mock).mock.calls[0][0].data.role).toBe('TEACHER');
    });
    it('throws 409 on duplicate email', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      await expect(
        service.create({ email: 'student@demo', password: 'Password1', name: 'N' }, ORG_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates fields', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, name: 'New' });
      const r = await service.update('user-student-0001', { name: 'New' }, ORG_ID, ADMIN_ID);
      expect(r.name).toBe('New');
    });
    it('throws 403 org mismatch', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(
        service.update('user-student-0001', { name: 'New' }, OTHER_ORG, ADMIN_ID),
      ).rejects.toThrow(ForbiddenException);
    });
    it('throws 400 on self-role-change', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(
        service.update(ADMIN_ID, { role: 'STUDENT' as any }, ORG_ID, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });
    it('does not throw 400 if self-update without role change', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      await expect(
        service.update(ADMIN_ID, { name: 'Self' }, ORG_ID, ADMIN_ID),
      ).resolves.toBeDefined();
    });
  });

  describe('remove', () => {
    it('deletes user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.delete as jest.Mock).mockResolvedValue({});
      await service.remove('user-student-0001', ORG_ID, ADMIN_ID);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-student-0001' } });
    });
    it('throws 403 org mismatch', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.remove('user-student-0001', OTHER_ORG, ADMIN_ID)).rejects.toThrow(ForbiddenException);
    });
    it('throws 400 self-delete', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, id: ADMIN_ID });
      await expect(service.remove(ADMIN_ID, ORG_ID, ADMIN_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
