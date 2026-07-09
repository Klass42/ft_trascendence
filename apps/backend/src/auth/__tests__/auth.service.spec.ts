import { ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from '../auth.service';
import type { PrismaService } from '@/prisma/prisma.service';

const SEED_ORG_ID = 'org-klass-0001';

const mockUser = {
  id: 'user-student-0001',
  organizationId: SEED_ORG_ID,
  email: 'student@demo',
  passwordHash: '',
  name: 'Sam Student',
  avatarUrl: null,
  role: 'STUDENT' as const,
  onlineAt: null,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mkConfig = () => ({
  getOrThrow: jest.fn((key: string) => {
    if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret';
    if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
    throw new Error(`Unknown config key: ${key}`);
  }),
}) as unknown as ConfigService;

const mkJwtService = () => ({
  sign: jest.fn((payload: unknown, opts?: unknown) => {
    const options = opts as { secret?: string } | undefined;
    if (options?.secret === 'test-refresh-secret') return 'refresh-token-mock';
    return 'access-token-mock';
  }),
}) as unknown as JwtService;

let mockUserFindFirst: jest.Mock;
let mockUserCreate: jest.Mock;
let mockSessionCreate: jest.Mock;
let mockSessionUpdate: jest.Mock;

const mkPrisma = () => ({
  user: {
    findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
    create: (...a: unknown[]) => mockUserCreate(...a),
  },
  session: {
    create: (...a: unknown[]) => mockSessionCreate(...a),
    update: (...a: unknown[]) => mockSessionUpdate(...a),
  },
}) as unknown as PrismaService;

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockUserFindFirst = jest.fn();
    mockUserCreate = jest.fn();
    mockSessionCreate = jest.fn();
    mockSessionUpdate = jest.fn();
    process.env.NODE_ENV = 'development';
    service = new AuthService(mkPrisma(), mkJwtService(), mkConfig());
  });
  afterAll(() => { process.env.NODE_ENV = 'test'; });

  describe('register', () => {
    it('creates a new user and returns tokens', async () => {
      mockUserFindFirst.mockResolvedValue(null);
      mockSessionCreate.mockResolvedValue({ id: 'session-1', refreshTokenHash: 'hash' });
      mockUserCreate.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'new@demo',
        password: 'Password1',
        name: 'New User',
      });

      expect(result.user.email).toBe('student@demo');
      expect(result.user).toEqual({
        userId: 'user-student-0001',
        email: 'student@demo',
        name: 'Sam Student',
        avatarUrl: null,
        organizationId: SEED_ORG_ID,
        role: 'STUDENT',
      });
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
    });

    it('throws 409 on duplicate email within org', async () => {
      mockUserFindFirst.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'student@demo', password: 'Password1', name: 'Dup' }),
      ).rejects.toThrow(ConflictException);
    });

    it('auto-verifies email in dev (emailVerifiedAt set)', async () => {
      mockUserFindFirst.mockResolvedValue(null);
      mockSessionCreate.mockResolvedValue({ id: 'session-1', refreshTokenHash: 'hash' });
      mockUserCreate.mockResolvedValue({ ...mockUser, emailVerifiedAt: new Date() });

      await service.register({ email: 'new@demo', password: 'Password1', name: 'New' });
      expect(mockUserCreate).toHaveBeenCalled();
      const createData = (mockUserCreate.mock.calls[0][0] as { data: { emailVerifiedAt?: Date } }).data;
      expect(createData.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('leaves emailVerifiedAt null in production', async () => {
      process.env.NODE_ENV = 'production';
      mockUserFindFirst.mockResolvedValue(null);
      mockSessionCreate.mockResolvedValue({ id: 'session-1', refreshTokenHash: 'hash' });
      mockUserCreate.mockResolvedValue({ ...mockUser, emailVerifiedAt: null });

      await service.register({ email: 'new@demo', password: 'Password1', name: 'New' });
      const createData = (mockUserCreate.mock.calls[0][0] as { data: { emailVerifiedAt?: Date | null } }).data;
      expect(createData.emailVerifiedAt).toBeNull();
      process.env.NODE_ENV = 'development';
    });
  });

  describe('login', () => {
    it('returns tokens on valid credentials', async () => {
      const hash = await argon2.hash('demo1234');
      mockUserFindFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockSessionCreate.mockResolvedValue({ id: 'session-1', refreshTokenHash: 'hash' });

      const result = await service.login({ email: 'student@demo', password: 'demo1234' });

      expect(result.user.userId).toBe('user-student-0001');
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
    });

    it('throws 401 on wrong password', async () => {
      const hash = await argon2.hash('demo1234');
      mockUserFindFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.login({ email: 'student@demo', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when user not found', async () => {
      mockUserFindFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@demo', password: 'demo1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 403 when email is not verified', async () => {
      const hash = await argon2.hash('demo1234');
      mockUserFindFirst.mockResolvedValue({ ...mockUser, passwordHash: hash, emailVerifiedAt: null });

      await expect(
        service.login({ email: 'student@demo', password: 'demo1234' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
