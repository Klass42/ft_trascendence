import { ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsersService } from '../users.service';
import { SearchUsersDto } from '../dto/search-users.dto';
import type { NotificationsService } from '../../notifications/notifications.service';
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
  user: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
  friendship: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
}) as unknown as PrismaService;

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mkPrisma>;
  let notifications: { emit: jest.Mock };
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mkPrisma();
    notifications = { emit: jest.fn().mockResolvedValue({}) };
    service = new UsersService(prisma, notifications as unknown as NotificationsService);
    process.env.NODE_ENV = 'development';
  });
  afterAll(() => { process.env.NODE_ENV = previousNodeEnv; });

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
    it('throws ConflictException on Prisma P2002 race condition', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      (prisma.user.create as jest.Mock).mockRejectedValue(prismaError);
      await expect(
        service.create({ email: 'race@demo', password: 'Password1', name: 'N' }, ORG_ID),
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
    it('throws 409 if changing email to one already used in the org', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-other', email: 'taken@demo', organizationId: ORG_ID });
      await expect(
        service.update('user-student-0001', { email: 'taken@demo' }, ORG_ID, ADMIN_ID),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
    it('throws ConflictException on Prisma P2002 race when updating email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      (prisma.user.update as jest.Mock).mockRejectedValue(prismaError);
      await expect(
        service.update('user-student-0001', { email: 'taken@demo' }, ORG_ID, ADMIN_ID),
      ).rejects.toThrow(ConflictException);
    });
    it('does not check uniqueness when email is unchanged (same as current)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      await service.update('user-student-0001', { email: 'student@demo' }, ORG_ID, ADMIN_ID);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
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

  // ── findOne role-aware ──
  describe('findOne (role-aware)', () => {
    it('returns full fields for ADMIN caller', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const r = await service.findOne('user-student-0001', ORG_ID, 'ADMIN') as any;
      expect(r.email).toBe('student@demo');
      expect(r.organizationId).toBe(ORG_ID);
    });

    it('returns public fields only for STUDENT caller', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const r = await service.findOne('user-student-0001', ORG_ID, 'STUDENT');
      expect(r.id).toBe('user-student-0001');
      expect(r.name).toBe('Sam');
      expect((r as any).email).toBeUndefined();
      expect((r as any).organizationId).toBeUndefined();
    });

    it('throws ForbiddenException for org mismatch in STUDENT role', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.findOne('user-student-0001', OTHER_ORG, 'STUDENT')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── updateProfile ──
  describe('updateProfile', () => {
    it('updates name and bio for the caller', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-student-0001', name: 'New', bio: 'Bio', avatarUrl: null, role: 'STUDENT', onlineAt: null, email: 'student@demo', organizationId: 'org-klass-0001', emailNotificationsEnabled: true, preferredLanguage: 'es' });
      const r = await service.updateProfile('user-student-0001', { name: 'New', bio: 'Bio' });
      expect(r.name).toBe('New');
      expect(r.email).toBe('student@demo');
    });

    it('persists preference fields and selects them back (own profile)', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser, emailNotificationsEnabled: false, preferredLanguage: 'en',
      });

      const r = await service.updateProfile('user-student-0001', {
        emailNotificationsEnabled: false,
        preferredLanguage: 'en',
      });

      const args = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(args.data).toEqual({ emailNotificationsEnabled: false, preferredLanguage: 'en' });
      expect(args.select.emailNotificationsEnabled).toBe(true);
      expect(args.select.preferredLanguage).toBe(true);
      expect(r.emailNotificationsEnabled).toBe(false);
      expect(r.preferredLanguage).toBe('en');
    });

    it('persists avatarUrl as a plain string', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser, avatarUrl: '/api/files/file-1/url',
      });

      await service.updateProfile('user-student-0001', { avatarUrl: '/api/files/file-1/url' });

      const args = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(args.data).toEqual({ avatarUrl: '/api/files/file-1/url' });
    });

    it('rejects an invalid preferredLanguage at the DTO level', async () => {
      const { UpdateProfileDto } = await import('../dto/update-profile.dto');
      const { validate } = await import('class-validator');
      const dto = Object.assign(new UpdateProfileDto(), { preferredLanguage: 'fr' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── sendFriendRequest ──
  describe('sendFriendRequest', () => {
    beforeEach(() => {
      (prisma.user.findFirst as jest.Mock).mockImplementation(({ where }: any) =>
        where.id === ADMIN_ID
          ? Promise.resolve({ id: ADMIN_ID })
          : where.id === mockUser.id && where.organizationId === ORG_ID
            ? Promise.resolve({ id: mockUser.id })
            : Promise.resolve(null),
      );
    });

    it('creates a PENDING friendship', async () => {
      const mkFriendshipCreate = jest.fn();
      (prisma as any).friendship = { findFirst: jest.fn().mockResolvedValue(null), create: mkFriendshipCreate };
      mkFriendshipCreate.mockResolvedValue({ id: 'f1', requesterId: ADMIN_ID, addresseeId: 'user-student-0001', status: 'PENDING', createdAt: new Date() });
      const r = await service.sendFriendRequest(ADMIN_ID, 'user-student-0001', ORG_ID);
      expect(r.status).toBe('PENDING');
      expect(notifications.emit).toHaveBeenCalledWith('user-student-0001', 'FRIEND_REQUEST', expect.objectContaining({ link: '/friends' }));
    });

    it('throws 409 if friendship already exists', async () => {
      (prisma as any).friendship = { findFirst: jest.fn().mockResolvedValue({ id: 'f1' }), create: jest.fn() };
      await expect(service.sendFriendRequest(ADMIN_ID, 'user-student-0001', ORG_ID)).rejects.toThrow(ConflictException);
    });

    it('throws 400 on self-friend', async () => {
      (prisma as any).friendship = { findFirst: jest.fn(), create: jest.fn() };
      await expect(service.sendFriendRequest(ADMIN_ID, ADMIN_ID, ORG_ID)).rejects.toThrow(BadRequestException);
    });

    it('does not create a friendship with a user from another organization', async () => {
      (prisma.user.findFirst as jest.Mock).mockImplementation(({ where }: any) =>
        where.id === ADMIN_ID ? Promise.resolve({ id: ADMIN_ID }) : Promise.resolve(null),
      );
      (prisma as any).friendship = { findFirst: jest.fn(), create: jest.fn() };
      await expect(service.sendFriendRequest(ADMIN_ID, 'user-student-0001', ORG_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });
  });

  // ── listFriends ──
  describe('listFriends', () => {
    it('returns accepted friends (bidirectional)', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-teacher-0001', name: 'Theo', avatarUrl: null, role: 'TEACHER', bio: null, onlineAt: null }]);
      (prisma as any).friendship = { findMany: jest.fn().mockResolvedValue([{ requesterId: ADMIN_ID, addresseeId: 'user-teacher-0001' }, { requesterId: 'user-student-0001', addresseeId: ADMIN_ID }]) };
      const r = await service.listFriends(ADMIN_ID, ORG_ID);
      expect(r).toHaveLength(1);
      expect((r[0] as any).email).toBeUndefined();
    });

    it('keeps prefs out of the public profile select (listFriends)', async () => {
      (prisma.friendship.findMany as jest.Mock).mockResolvedValue([
        { requesterId: 'user-student-0001', addresseeId: 'user-teacher-0001' },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await service.listFriends('user-student-0001', ORG_ID);

      const args = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(args.select.emailNotificationsEnabled).toBeUndefined();
      expect(args.select.preferredLanguage).toBeUndefined();
    });
  });

  describe('searchUsers', () => {
    it('searches only within the organization and returns no email', async () => {
      const result = [{ id: 'user-teacher-0001', name: 'Theo', avatarUrl: null }];
      (prisma.friendship.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(result);

      await expect(service.searchUsers('  th  ', ADMIN_ID, ORG_ID)).resolves.toEqual(result);
      const args = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.organizationId).toBe(ORG_ID);
      expect(args.where.OR).toEqual([
        { name: { contains: 'th', mode: 'insensitive' } },
        { email: { contains: 'th', mode: 'insensitive' } },
      ]);
      expect(args.take).toBe(20);
      expect(args.select).toEqual({ id: true, name: true, avatarUrl: true });
    });

    it('rejects a search shorter than two characters', async () => {
      await expect(service.searchUsers(' a ', ADMIN_ID, ORG_ID)).rejects.toThrow(BadRequestException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('validates the search query DTO after trimming whitespace', async () => {
      const dto = plainToInstance(SearchUsersDto, { q: ' a ' });
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'q')).toBe(true);
    });
  });

  describe('uploadAvatar', () => {
    it('stores a FilesService URL on the current user inside their organization', async () => {
      const files = {
        createUpload: jest.fn().mockResolvedValue({ id: 'file-1' }),
        getSignedUrl: jest.fn().mockResolvedValue({ url: '/api/files/file-1/url' }),
      };
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ ...mockUser, avatarUrl: '/api/files/file-1/url' });
      const uploadService = new UsersService(
        prisma,
        notifications as unknown as NotificationsService,
        files as any,
      );
      const authUser = { userId: mockUser.id, organizationId: ORG_ID } as any;
      const file = { originalname: 'avatar.png', mimetype: 'image/png', size: 8, buffer: Buffer.from('png') } as Express.Multer.File;

      const result = await uploadService.uploadAvatar(authUser, file);

      expect(files.createUpload).toHaveBeenCalledWith(file, ORG_ID, mockUser.id, 'AVATAR');
      expect(files.getSignedUrl).toHaveBeenCalledWith('file-1', authUser);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: mockUser.id, organizationId: ORG_ID },
        data: { avatarUrl: '/api/files/file-1/url' },
      });
      expect(result?.avatarUrl).toBe('/api/files/file-1/url');
    });

    it('clears the current avatar only inside the caller organization', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ ...mockUser, avatarUrl: null });

      const result = await service.removeAvatar({ userId: mockUser.id, organizationId: ORG_ID } as any);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: mockUser.id, organizationId: ORG_ID },
        data: { avatarUrl: null },
      });
      expect(result?.avatarUrl).toBeNull();
    });
  });

  // ── findByIds ──
  describe('findByIds', () => {
    it('returns matching users org-scoped (no passwordHash)', async () => {
      const users = [
        { id: 'u1', name: 'Alice', email: 'a@demo', avatarUrl: null },
        { id: 'u2', name: 'Bob', email: 'b@demo', avatarUrl: '/img.png' },
      ];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(users);

      const result = await service.findByIds(['u1', 'u2', 'u3'], ORG_ID);

      expect(result).toEqual(users);
      const args = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where).toEqual({ id: { in: ['u1', 'u2', 'u3'] }, organizationId: ORG_ID });
      expect(args.select.passwordHash).toBeUndefined();
      expect(args.select.id).toBe(true);
      expect(args.select.name).toBe(true);
      expect(args.select.email).toBe(true);
      expect(args.select.avatarUrl).toBe(true);
    });

    it('returns empty array for empty ids without calling Prisma', async () => {
      const result = await service.findByIds([], ORG_ID);

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  // ── lookupByEmail ──
  describe('lookupByEmail', () => {
    it('returns user DTO when found (teacher caller)', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'u1', name: 'Sam', email: 'sam@demo', avatarUrl: null, role: 'STUDENT',
      });

      const result = await service.lookupByEmail('sam@demo', ORG_ID, 'TEACHER');

      expect(result).toEqual({ userId: 'u1', name: 'Sam', email: 'sam@demo', avatarUrl: null });
      const args = (prisma.user.findFirst as jest.Mock).mock.calls[0][0];
      expect(args.where).toEqual({ organizationId: ORG_ID, email: 'sam@demo' });
    });

    it('throws NotFoundException when user not found', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.lookupByEmail('ghost@demo', ORG_ID, 'TEACHER'))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when teacher looks up ADMIN', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'u-admin', name: 'Admin', email: 'admin@demo', avatarUrl: null, role: 'ADMIN',
      });

      await expect(service.lookupByEmail('admin@demo', ORG_ID, 'TEACHER'))
        .rejects.toThrow(ForbiddenException);
    });
  });
});
