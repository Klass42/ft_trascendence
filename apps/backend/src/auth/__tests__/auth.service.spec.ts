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
  platformRole: 'NONE' as const,
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
  verify: jest.fn(() => {
    throw new Error('Invalid token');
  }),
}) as unknown as JwtService;

let mockOrganizationFindUnique: jest.Mock;
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
  organization: {
    findUnique: (...a: unknown[]) => mockOrganizationFindUnique(...a),
  },
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
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockOrganizationFindUnique = jest.fn().mockResolvedValue({
      id: SEED_ORG_ID,
      slug: 'klass',
      status: 'ACTIVE',
    });
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
        organizationSlug: 'klass',
      });

      expect(result.user.email).toBe('student@demo');
      expect(result.user).toEqual({
        userId: 'user-student-0001',
        email: 'student@demo',
        name: 'Sam Student',
        avatarUrl: null,
        organizationId: SEED_ORG_ID,
        role: 'STUDENT',
        platformRole: 'NONE',
        emailNotificationsEnabled: true,
        preferredLanguage: 'es',
      });
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
      expect(mockOrganizationFindUnique).toHaveBeenCalledWith({ where: { slug: 'klass' } });
    });

    it('throws 409 on duplicate email within org', async () => {
      mockUserFindFirst.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'student@demo', password: 'Password1', name: 'Dup', organizationSlug: 'klass' }),
      ).rejects.toThrow(ConflictException);
    });

    it('auto-verifies email in dev (emailVerifiedAt set)', async () => {
      mockUserFindFirst.mockResolvedValue(null);
      mockSessionCreate.mockResolvedValue({ id: 'session-1', refreshTokenHash: 'hash' });
      mockUserCreate.mockResolvedValue({ ...mockUser, emailVerifiedAt: new Date() });

      await service.register({ email: 'new@demo', password: 'Password1', name: 'New', organizationSlug: 'klass' });
      expect(mockUserCreate).toHaveBeenCalled();
      const createData = (mockUserCreate.mock.calls[0][0] as { data: { emailVerifiedAt?: Date } }).data;
      expect(createData.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('leaves emailVerifiedAt null in production', async () => {
      process.env.NODE_ENV = 'production';
      mockUserFindFirst.mockResolvedValue(null);
      mockSessionCreate.mockResolvedValue({ id: 'session-1', refreshTokenHash: 'hash' });
      mockUserCreate.mockResolvedValue({ ...mockUser, emailVerifiedAt: null });

      await service.register({ email: 'new@demo', password: 'Password1', name: 'New', organizationSlug: 'klass' });
      const createData = (mockUserCreate.mock.calls[0][0] as { data: { emailVerifiedAt?: Date | null } }).data;
      expect(createData.emailVerifiedAt).toBeNull();
      expect(console.log).not.toHaveBeenCalled();
      process.env.NODE_ENV = 'development';
    });
  });

  describe('login', () => {
    it('returns tokens on valid credentials', async () => {
      const hash = await argon2.hash('demo1234');
      mockUserFindFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockSessionCreate.mockResolvedValue({ id: 'session-1', refreshTokenHash: 'hash' });

      const result = await service.login({ email: 'student@demo', password: 'demo1234', organizationSlug: 'klass' });

      expect(result.user.userId).toBe('user-student-0001');
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
    });

    it('uses a distinct session bootstrap hash for concurrent logins', async () => {
      const hash = await argon2.hash('demo1234');
      mockUserFindFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockSessionCreate
        .mockResolvedValueOnce({ id: 'session-1' })
        .mockResolvedValueOnce({ id: 'session-2' });

      await Promise.all([
        service.login({ email: 'student@demo', password: 'demo1234', organizationSlug: 'klass' }),
        service.login({ email: 'student@demo', password: 'demo1234', organizationSlug: 'klass' }),
      ]);

      const hashes = mockSessionCreate.mock.calls.map(
        ([input]: [{ data: { refreshTokenHash: string } }]) => input.data.refreshTokenHash,
      );
      expect(hashes).toHaveLength(2);
      expect(new Set(hashes).size).toBe(2);
      expect(hashes).not.toContain('placeholder');
    });

    it('throws 401 on wrong password', async () => {
      const hash = await argon2.hash('demo1234');
      mockUserFindFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.login({ email: 'student@demo', password: 'wrong', organizationSlug: 'klass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when user not found', async () => {
      mockUserFindFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@demo', password: 'demo1234', organizationSlug: 'klass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 403 when email is not verified', async () => {
      const hash = await argon2.hash('demo1234');
      mockUserFindFirst.mockResolvedValue({ ...mockUser, passwordHash: hash, emailVerifiedAt: null });

      await expect(
        service.login({ email: 'student@demo', password: 'demo1234', organizationSlug: 'klass' }),
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
        verify: jest.fn(() => ({
          sub: mockUser.id,
          jti: 'old-session',
          purpose: 'refresh',
        })),
      } as unknown as JwtService;

      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());
      const oldToken = 'refresh:old-session';
      const crypto = require('crypto');
      mockSessionFindUnique.mockResolvedValue({
        id: 'old-session',
        userId: mockUser.id,
        refreshTokenHash: crypto.createHash('sha256').update(oldToken).digest('hex'),
        expiresAt: new Date(Date.now() + 100000),
        user: { organization: { status: 'ACTIVE' } },
      });
      mockSessionDelete.mockResolvedValue({});
      mockSessionCreate.mockResolvedValue({ id: 'new-session' });

      const result = await service2.refresh(oldToken);
      expect(result.accessToken).toBe('access:user-student-0001');
      expect(result.refreshToken).toBe('refresh:new-session');
    });

    it('revokes sessions after validly signed refresh-token reuse', async () => {
      const jwtService = {
        sign: jest.fn(),
        decode: jest.fn(),
        verify: jest.fn(() => ({
          sub: mockUser.id,
          jti: 'old-session',
          purpose: 'refresh',
        })),
      } as unknown as JwtService;
      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());
      mockSessionFindUnique.mockResolvedValue(null);
      mockSessionDeleteMany.mockResolvedValue({});

      await expect(service2.refresh('some-old-token')).rejects.toThrow(UnauthorizedException);
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: mockUser.id } });
    });

    it('does not revoke the forged subject from a token with an invalid signature', async () => {
      const jwtService = mkJwtService();
      (jwtService.decode as jest.Mock).mockReturnValue({
        sub: 'victim-user-id',
        jti: 'victim-session-id',
        purpose: 'refresh',
      });
      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());
      const forgedToken = `eyJhbGciOiJub25lIn0.${Buffer.from(
        JSON.stringify({ sub: 'victim-user-id', jti: 'victim-session-id', purpose: 'refresh' }),
      ).toString('base64url')}.invalid-signature`;

      await expect(service2.refresh(forgedToken)).rejects.toThrow(UnauthorizedException);
      expect(mockSessionDeleteMany).not.toHaveBeenCalled();
      expect(jwtService.verify).toHaveBeenCalledWith(forgedToken, { secret: 'test-refresh-secret' });
    });

    it('does not revoke sessions when a signed token has the wrong purpose or no jti', async () => {
      const jwtService = {
        sign: jest.fn(),
        decode: jest.fn(),
        verify: jest.fn()
          .mockReturnValueOnce({ sub: 'victim-user-id', jti: 'session-1', purpose: 'access' })
          .mockReturnValueOnce({ sub: 'victim-user-id', purpose: 'refresh' }),
      } as unknown as JwtService;
      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());

      await expect(service2.refresh('wrong-purpose')).rejects.toThrow(UnauthorizedException);
      await expect(service2.refresh('missing-jti')).rejects.toThrow(UnauthorizedException);
      expect(mockSessionFindUnique).not.toHaveBeenCalled();
      expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    });

    it('throws 401 on expired refresh token', async () => {
      const crypto = require('crypto');
      const jwtService = {
        sign: jest.fn(),
        decode: jest.fn(),
        verify: jest.fn(() => ({ sub: mockUser.id, jti: 'expired-session', purpose: 'refresh' })),
      } as unknown as JwtService;
      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());
      mockSessionFindUnique.mockResolvedValue({
        id: 'expired-session',
        userId: mockUser.id,
        refreshTokenHash: crypto.createHash('sha256').update('expired').digest('hex'),
        expiresAt: new Date(Date.now() - 100000),
        user: { organization: { status: 'ACTIVE' } },
      });

      await expect(service2.refresh('expired')).rejects.toThrow(UnauthorizedException);
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
      await expect(service2.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
    });

    it.each(['invalid signature', 'expired'])('returns 400 for an %s verification token', async () => {
      const jwtService = {
        sign: jest.fn(),
        decode: jest.fn(),
        verify: jest.fn(() => {
          throw new Error('TokenExpiredError');
        }),
      } as unknown as JwtService;
      const service2 = new AuthService(mkPrisma(), jwtService, mkConfig());

      await expect(service2.verifyEmail('bad-token')).rejects.toMatchObject({
        status: 400,
        response: { message: 'El enlace de verificación no es válido o ha caducado.' },
      });
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe('googleLogin', () => {
    const googleProfile = {
      providerUserId: 'google-123',
      email: 'newuser@gmail.com',
      name: 'Google User',
      avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
    };

    it('returns tokens when OAuthAccount already linked to this organization', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue({
        userId: mockUser.id,
        provider: 'google',
        providerUserId: 'google-123',
        user: mockUser,
      });
      mockSessionCreate.mockResolvedValue({ id: 'session-g1' });

      const result = await service.googleLogin(googleProfile, 'klass');
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
      expect(mockOAuthAccountCreate).not.toHaveBeenCalled();
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it('rejects a Google account linked to another organization', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue({
        userId: 'user-other',
        user: { ...mockUser, organizationId: 'org-other' },
      });
      await expect(service.googleLogin(googleProfile, 'klass')).rejects.toThrow(ForbiddenException);
      expect(mockOAuthAccountCreate).not.toHaveBeenCalled();
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it('links an existing user in the organization by email', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(mockUser);
      mockOAuthAccountCreate.mockResolvedValue({ id: 'oauth-1' });
      mockSessionCreate.mockResolvedValue({ id: 'session-g2' });

      const result = await service.googleLogin(
        { ...googleProfile, email: 'Student@Demo' },
        'klass',
      );

      expect(result.accessToken).toBe('access-token-mock');
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockUserFindFirst).toHaveBeenCalledWith({
        where: {
          organizationId: SEED_ORG_ID,
          email: { equals: 'student@demo', mode: 'insensitive' },
        },
      });
      expect(mockOAuthAccountCreate).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          provider: 'google',
          providerUserId: 'google-123',
        },
      });
    });

    it('creates a student in the chosen organization when the email is new', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ ...mockUser, id: 'user-google-new', email: 'newuser@gmail.com' });
      mockOAuthAccountCreate.mockResolvedValue({ id: 'oauth-2' });
      mockSessionCreate.mockResolvedValue({ id: 'session-g3' });

      const result = await service.googleLogin(googleProfile, 'klass');

      expect(result.accessToken).toBe('access-token-mock');
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: SEED_ORG_ID,
          email: 'newuser@gmail.com',
          name: 'Google User',
          passwordHash: null,
          role: 'STUDENT',
          avatarUrl: googleProfile.avatarUrl,
        }),
      });
      expect(mockOAuthAccountCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-google-new',
          provider: 'google',
          providerUserId: 'google-123',
        },
      });
    });

    it('rejects an unknown organization', async () => {
      mockOrganizationFindUnique.mockResolvedValue(null);
      await expect(service.googleLogin(googleProfile, 'missing')).rejects.toThrow(UnauthorizedException);
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockOAuthAccountCreate).not.toHaveBeenCalled();
    });

    it.each(['SUSPENDED', 'ARCHIVED'] as const)(
      'rejects an organization that is not active (%s) without creating records',
      async (status) => {
        mockOrganizationFindUnique.mockResolvedValue({
          id: SEED_ORG_ID,
          slug: 'klass',
          status,
        });

        await expect(service.googleLogin(googleProfile, 'klass')).rejects.toThrow(UnauthorizedException);
        expect(mockUserCreate).not.toHaveBeenCalled();
        expect(mockOAuthAccountCreate).not.toHaveBeenCalled();
        expect(mockOAuthAccountFindUnique).not.toHaveBeenCalled();
      },
    );

    it.each(['', '   ', '\n\t'])(
      'rejects a blank Google email (%j) without creating records',
      async (email) => {
        await expect(
          service.googleLogin({ ...googleProfile, email }, 'klass'),
        ).rejects.toThrow(UnauthorizedException);
        expect(mockUserCreate).not.toHaveBeenCalled();
        expect(mockOAuthAccountCreate).not.toHaveBeenCalled();
        expect(mockOAuthAccountFindUnique).not.toHaveBeenCalled();
      },
    );

    it('sets emailVerifiedAt when linking an existing unverified user', async () => {
      const unverified = { ...mockUser, emailVerifiedAt: null };
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(unverified);
      mockUserUpdate.mockImplementation(async (args: { data: { emailVerifiedAt: Date } }) => ({
        ...unverified,
        ...args.data,
      }));
      mockOAuthAccountCreate.mockResolvedValue({ id: 'oauth-unverified' });
      mockSessionCreate.mockResolvedValue({ id: 'session-unverified' });

      const result = await service.googleLogin(googleProfile, 'klass');

      expect(result.accessToken).toBe('access-token-mock');
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { emailVerifiedAt: expect.any(Date) },
      });
      expect(mockOAuthAccountCreate).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          provider: 'google',
          providerUserId: 'google-123',
        },
      });
    });

    it('does not rewrite emailVerifiedAt when the matched user is already verified', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(mockUser);
      mockOAuthAccountCreate.mockResolvedValue({ id: 'oauth-verified' });
      mockSessionCreate.mockResolvedValue({ id: 'session-verified' });

      const result = await service.googleLogin(
        { ...googleProfile, email: '  Student@Demo  ' },
        'klass',
      );

      expect(result.accessToken).toBe('access-token-mock');
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockUserFindFirst).toHaveBeenCalledWith({
        where: {
          organizationId: SEED_ORG_ID,
          email: { equals: 'student@demo', mode: 'insensitive' },
        },
      });
      expect(mockOAuthAccountCreate).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          provider: 'google',
          providerUserId: 'google-123',
        },
      });
    });

    it('stores a trimmed lowercase email, a trimmed name, and emailVerifiedAt', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ ...mockUser, id: 'user-trim', email: 'ada@example.com' });
      mockOAuthAccountCreate.mockResolvedValue({ id: 'oauth-trim' });
      mockSessionCreate.mockResolvedValue({ id: 'session-trim' });

      await service.googleLogin(
        {
          ...googleProfile,
          email: '  Ada@Example.com  ',
          name: '  Ada Lovelace  ',
          avatarUrl: null,
        },
        'klass',
      );

      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: SEED_ORG_ID,
          email: 'ada@example.com',
          name: 'Ada Lovelace',
          passwordHash: null,
          role: 'STUDENT',
          avatarUrl: null,
          emailVerifiedAt: expect.any(Date),
        }),
      });
      expect(mockOAuthAccountCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-trim',
          provider: 'google',
          providerUserId: 'google-123',
        },
      });
    });

    it('uses the normalized email as the name when the Google name is blank', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ ...mockUser, id: 'user-noname', email: 'ada@example.com' });
      mockOAuthAccountCreate.mockResolvedValue({ id: 'oauth-noname' });
      mockSessionCreate.mockResolvedValue({ id: 'session-noname' });

      await service.googleLogin(
        { ...googleProfile, email: 'Ada@Example.com', name: '   ' },
        'klass',
      );

      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'ada@example.com',
          name: 'ada@example.com',
          passwordHash: null,
          role: 'STUDENT',
        }),
      });
    });
  });

  // #74: el alta por invitación auto-verifica el email (el admin de la org ya eligió ese email).
  describe('acceptInvitation (#74)', () => {
    it('creates the user with emailVerifiedAt set', async () => {
      const txUserCreate = jest.fn(async (args: { data: Record<string, unknown> }) => ({ ...mockUser, ...args.data, id: 'user-invited' }));
      const tx = {
        organizationInvitation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1', organizationId: SEED_ORG_ID, email: 'new@demo', role: 'TEACHER', status: 'PENDING',
            expiresAt: new Date(Date.now() + 60_000), organization: { status: 'ACTIVE' },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        user: { findFirst: jest.fn().mockResolvedValue(null), create: txUserCreate },
        auditLog: { create: jest.fn() },
      };
      const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
      const svc = new AuthService(prisma, mkJwtService(), mkConfig());

      const user = await svc.acceptInvitation('raw-token', { name: 'Nuevo', password: 'Password123!' } as never);

      expect(txUserCreate.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    });
  });
});
