import { BadRequestException, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
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
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
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
  decode: jest.fn(),
}) as unknown as JwtService;

let mockUserFindFirst: jest.Mock;
let mockUserCreate: jest.Mock;
let mockSessionCreate: jest.Mock;
let mockSessionUpdate: jest.Mock;
let mockSessionFindUnique: jest.Mock;
let mockSessionDelete: jest.Mock;
let mockSessionDeleteMany: jest.Mock;
let mockUserFindUnique: jest.Mock;
let mockUserUpdate: jest.Mock;
let mockOAuthAccountFindUnique: jest.Mock;
let mockOAuthAccountCreate: jest.Mock;

const mkPrisma = () => ({
  user: {
    findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
    create: (...a: unknown[]) => mockUserCreate(...a),
    findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    update: (...a: unknown[]) => mockUserUpdate(...a),
  },
  session: {
    create: (...a: unknown[]) => mockSessionCreate(...a),
    update: (...a: unknown[]) => mockSessionUpdate(...a),
    findUnique: (...a: unknown[]) => mockSessionFindUnique(...a),
    delete: (...a: unknown[]) => mockSessionDelete(...a),
    deleteMany: (...a: unknown[]) => mockSessionDeleteMany(...a),
  },
  oAuthAccount: {
    findUnique: (...a: unknown[]) => mockOAuthAccountFindUnique(...a),
    create: (...a: unknown[]) => mockOAuthAccountCreate(...a),
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
    mockSessionFindUnique = jest.fn();
    mockSessionDelete = jest.fn();
    mockSessionDeleteMany = jest.fn();
    mockUserFindUnique = jest.fn();
    mockUserUpdate = jest.fn();
    mockOAuthAccountFindUnique = jest.fn();
    mockOAuthAccountCreate = jest.fn();
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
        emailNotificationsEnabled: true,
        preferredLanguage: 'es',
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

  describe('refresh', () => {
    it('returns new token pair on valid refresh token', async () => {
      const jwtService = {
        sign: jest.fn((payload: unknown, opts?: unknown) => {
          const options = opts as { secret?: string } | undefined;
          if (options?.secret === 'test-refresh-secret') {
            const p = payload as { jti?: string };
            return `refresh:${p.jti ?? 'no-jti'}`;
          }
          return 'access:user-student-0001';
        }),
        decode: jest.fn(),
        verify: jest.fn(),
      } as unknown as JwtService;

      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());
      const oldToken = 'refresh:old-session';
      const crypto = require('crypto');
      mockSessionFindUnique.mockResolvedValue({
        id: 'old-session',
        userId: mockUser.id,
        refreshTokenHash: crypto.createHash('sha256').update(oldToken).digest('hex'),
        expiresAt: new Date(Date.now() + 100000),
      });
      mockSessionDelete.mockResolvedValue({});
      mockSessionCreate.mockResolvedValue({ id: 'new-session' });

      const result = await service2.refresh(oldToken);
      expect(result.accessToken).toBe('access:user-student-0001');
      expect(result.refreshToken).toBe('refresh:new-session');
    });

    it('revokes all sessions and throws 401 on token reuse', async () => {
      mockSessionFindUnique.mockResolvedValue(null);
      mockSessionDeleteMany.mockResolvedValue({});

      await expect(service.refresh('some-old-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 on expired refresh token', async () => {
      const crypto = require('crypto');
      mockSessionFindUnique.mockResolvedValue({
        id: 'expired-session',
        userId: mockUser.id,
        refreshTokenHash: crypto.createHash('sha256').update('expired').digest('hex'),
        expiresAt: new Date(Date.now() - 100000),
      });

      await expect(service.refresh('expired')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('deletes the matching session', async () => {
      mockSessionFindUnique.mockResolvedValue({ id: 'session-1' });
      mockSessionDelete.mockResolvedValue({});

      await service.logout('some-refresh-token');
      expect(mockSessionDelete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('does not throw when session already gone', async () => {
      mockSessionFindUnique.mockResolvedValue(null);
      await expect(service.logout('ghost-token')).resolves.toBeUndefined();
    });
  });

  describe('changePassword', () => {
    it('updates the hash and revokes all sessions on success', async () => {
      const hash = await argon2.hash('Vieja1234');
      mockUserFindUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockUserUpdate.mockResolvedValue({});
      mockSessionDeleteMany.mockResolvedValue({ count: 2 });

      const result = await service.changePassword('user-student-0001', {
        currentPassword: 'Vieja1234',
        newPassword: 'Nueva1234',
      });

      expect(result).toEqual({ changed: true });
      const updateData = (mockUserUpdate.mock.calls[0][0] as { data: { passwordHash: string } }).data;
      expect(await argon2.verify(updateData.passwordHash, 'Nueva1234')).toBe(true);
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user-student-0001' } });
    });

    it('throws 400 when the current password is wrong (hash and sessions untouched)', async () => {
      const hash = await argon2.hash('Vieja1234');
      mockUserFindUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.changePassword('user-student-0001', { currentPassword: 'Mal12345', newPassword: 'Nueva1234' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    });

    it('throws 400 for OAuth-only accounts (passwordHash null)', async () => {
      mockUserFindUnique.mockResolvedValue({ ...mockUser, passwordHash: null });

      await expect(
        service.changePassword('user-google-0001', { currentPassword: 'x', newPassword: 'Nueva1234' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('throws 401 when the user no longer exists', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('ghost', { currentPassword: 'x', newPassword: 'Nueva1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a weak new password at the DTO level', async () => {
      const { ChangePasswordDto } = await import('../dto/change-password.dto');
      const { validate } = await import('class-validator');
      const dto = Object.assign(new ChangePasswordDto(), {
        currentPassword: 'Vieja1234',
        newPassword: 'debil',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects unknown fields through the global ValidationPipe config', async () => {
      const { ValidationPipe, BadRequestException: BRE } = await import('@nestjs/common');
      const { ChangePasswordDto } = await import('../dto/change-password.dto');
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
      await expect(
        pipe.transform(
          { currentPassword: 'Vieja1234', newPassword: 'Nueva1234', isAdmin: true },
          { type: 'body', metatype: ChangePasswordDto },
        ),
      ).rejects.toThrow(BRE);
    });
  });

  describe('getMe', () => {
    it('returns the AuthUser when user exists', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const result = await service.getMe('user-student-0001');
      expect(result.userId).toBe('user-student-0001');
    });

    it('throws 401 when user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      await expect(service.getMe('ghost')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    it('verifies email with valid token', async () => {
      const jwtService = {
        sign: jest.fn(),
        decode: jest.fn(),
        verify: jest.fn((token: string) => {
          if (token === 'valid-token') {
            return { sub: 'user-student-0001', purpose: 'email-verify' };
          }
          throw new Error('Invalid token');
        }),
      } as unknown as JwtService;

      mockUserUpdate.mockResolvedValue({ ...mockUser, emailVerifiedAt: new Date() });
      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());
      const result = await service2.verifyEmail('valid-token');
      expect(result).toEqual({ verified: true });
      expect(mockUserUpdate).toHaveBeenCalled();
    });

    it('throws 401 on invalid purpose', async () => {
      const jwtService = {
        sign: jest.fn(),
        decode: jest.fn(),
        verify: jest.fn(() => ({ sub: 'user-student-0001', purpose: 'wrong' })),
      } as unknown as JwtService;

      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());
      await expect(service2.verifyEmail('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('googleLogin', () => {
    const googleProfile = {
      providerUserId: 'google-123',
      email: 'newuser@gmail.com',
      name: 'Google User',
      avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
    };

    it('returns tokens when OAuthAccount already linked', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue({
        userId: mockUser.id,
        provider: 'google',
        providerUserId: 'google-123',
      });
      mockSessionCreate.mockResolvedValue({ id: 'session-g1' });

      const result = await service.googleLogin(googleProfile);
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
    });

    it('links existing user by email match and returns tokens', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(mockUser);
      mockOAuthAccountCreate.mockResolvedValue({});
      mockSessionCreate.mockResolvedValue({ id: 'session-g2' });

      const result = await service.googleLogin(googleProfile);
      expect(result.accessToken).toBe('access-token-mock');
      expect(mockOAuthAccountCreate).toHaveBeenCalled();
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it('creates a new user + OAuthAccount when no match', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ ...mockUser, id: 'user-google-0001', passwordHash: null });
      mockOAuthAccountCreate.mockResolvedValue({});
      mockSessionCreate.mockResolvedValue({ id: 'session-g3' });

      const result = await service.googleLogin(googleProfile);
      expect(result.accessToken).toBe('access-token-mock');
      const createData = (mockUserCreate.mock.calls[0][0] as { data: any }).data;
      expect(createData.passwordHash).toBeNull();
      expect(createData.emailVerifiedAt).toBeInstanceOf(Date);
      expect(createData.role).toBe('STUDENT');
      expect(mockOAuthAccountCreate).toHaveBeenCalled();
    });
  });
});
