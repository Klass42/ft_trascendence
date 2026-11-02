import { Test } from '@nestjs/testing';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CommonModule } from '@/common/common.module';
import { IS_PUBLIC_KEY } from '@/common/auth/public.decorator';
import type { AuthUser } from '@/common/auth/auth-user.type';
import { AuthModule } from '../auth.module';
import { GoogleAuthGuard } from '../google-auth.guard';
import type { GoogleProfile } from '../google.strategy';

/**
 * HTTP contract for Google sign-in.
 * Supertest does not follow redirects. No `code` query is sent: passport-oauth2
 * would exchange that code at Google's token endpoint. `error=` is handled first.
 */

const ORG_ID = 'org-klass-0001';

const prismaMock = {
  organization: { findUnique: jest.fn() },
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  oAuthAccount: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

let googleUser: GoogleProfile = {
  providerUserId: 'google-123',
  email: 'Ada@Example.com',
  name: 'Ada',
  avatarUrl: null,
};

@Injectable()
class StubGoogleAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: GoogleProfile;
      googleOrganizationSlug?: string;
    }>();
    req.user = googleUser;
    req.googleOrganizationSlug = 'klass-42';
    return true;
  }
}

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers?: Record<string, string | undefined>;
      user?: AuthUser;
    }>();
    const devUserId = req.headers?.['x-dev-user'];
    if (devUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: devUserId } });
      if (user) {
        req.user = {
          userId: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          organizationId: user.organizationId ?? '',
          role: user.role,
          platformRole: user.platformRole,
          emailNotificationsEnabled: user.emailNotificationsEnabled,
          preferredLanguage: user.preferredLanguage,
        };
        return true;
      }
    }
    throw new UnauthorizedException();
  }
}

function locationOf(res: request.Response): string {
  const location = res.headers.location;
  if (typeof location !== 'string' || location.length === 0) {
    throw new Error(`expected one Location header, got ${JSON.stringify(location)}`);
  }
  return location;
}

function expectSpaError(res: request.Response, code: string, origin = 'http://localhost:5173') {
  expect(res.status).toBe(302);
  expect(res.status).not.toBe(401);
  expect(res.status).not.toBe(403);
  expect(res.body).not.toMatchObject({ statusCode: 401, message: 'Unauthorized' });
  expect(locationOf(res)).toBe(`${origin}/auth/callback#error=${code}`);
}

async function createApp(options: {
  frontendUrl?: string;
  stubGuard?: boolean;
}): Promise<INestApplication> {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
  if (options.frontendUrl === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = options.frontendUrl;

  let builder = Test.createTestingModule({
    imports: [
        EventEmitterModule.forRoot(),
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      CommonModule,
      AuthModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: TestAuthGuard }],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaMock);

  if (options.stubGuard) {
    builder = builder.overrideGuard(GoogleAuthGuard).useClass(StubGoogleAuthGuard);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

describe('Google OAuth HTTP', () => {
  describe('real GoogleAuthGuard', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp({ frontendUrl: 'http://localhost:5173/' });
    });

    afterAll(async () => {
      await app?.close();
    });

    it('GET /auth/providers reports google:true when GOOGLE_CLIENT_ID is set (#136)', async () => {
      const res = await request(app.getHttpServer()).get('/auth/providers').expect(200);
      expect(res.body).toEqual({ google: true });
    });

    it('GET /auth/google without a slug is 400 and does not redirect', async () => {
      const res = await request(app.getHttpServer()).get('/auth/google').redirects(0);

      expect(res.status).toBe(400);
      expect(res.headers.location).toBeUndefined();
      expect(res.body).toMatchObject({
        statusCode: 400,
        message: 'El código de organización es obligatorio.',
      });
      expect(res.body).not.toMatchObject({ statusCode: 401, message: 'Unauthorized' });
    });

    it.each(['', 'Klass', 'bad slug', 'under_score', '-nope', 'nope-', 'double--dash'])(
      'GET /auth/google rejects invalid organizationSlug %j',
      async (organizationSlug) => {
        const res = await request(app.getHttpServer())
          .get('/auth/google')
          .query({ organizationSlug })
          .redirects(0);

        expect(res.status).toBe(400);
        expect(res.headers.location).toBeUndefined();
        expect(res.body).toMatchObject({
          statusCode: 400,
          message: 'El código de organización es obligatorio.',
        });
      },
    );

    it('GET /auth/google signs random state and binds it to an HttpOnly SameSite cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google')
        .query({ organizationSlug: 'klass-42' })
        .redirects(0);

      expect(res.status).toBe(302);
      const url = new URL(locationOf(res));
      expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      const state = url.searchParams.get('state');
      expect(state).toBeTruthy();
      expect(state).not.toBe('klass-42');
      const [payload, signature] = state!.split('.');
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      expect(decoded.organizationSlug).toBe('klass-42');
      expect(decoded.nonce).toMatch(/^[a-f0-9]{64}$/);
      expect(signature).toBeTruthy();
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining(`google_oauth_state=${state}`)]),
      );
      expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
      expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe('test-google-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/google/callback');
    });

    it.each(['access_denied', 'server_error'])(
      'GET /auth/google/callback?error=%s without browser state redirects to invalid_state',
      async (error) => {
        const res = await request(app.getHttpServer())
          .get('/auth/google/callback')
          .query({ error })
          .redirects(0);

        expectSpaError(res, 'invalid_state');
      },
    );

    it('redirects a callback with a tampered state to the SPA with a clear error', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ error: 'access_denied', state: 'forged-state' })
        .redirects(0);

      expectSpaError(res, 'invalid_state');
    });

    it('redirects a callback with no state to the SPA with a clear error', async () => {
      const res = await request(app.getHttpServer()).get('/auth/google/callback').redirects(0);

      expectSpaError(res, 'invalid_state');
    });

    it('accepts the protected state only with its browser cookie and consumes it once', async () => {
      const browser = request.agent(app.getHttpServer());
      const start = await browser
        .get('/auth/google')
        .query({ organizationSlug: 'klass-42' })
        .redirects(0);
      const state = new URL(locationOf(start)).searchParams.get('state');

      const callback = await browser
        .get('/auth/google/callback')
        .query({ error: 'access_denied', state })
        .redirects(0);
      expectSpaError(callback, 'oauth_failed');

      const replay = await browser
        .get('/auth/google/callback')
        .query({ error: 'access_denied', state })
        .redirects(0);
      expectSpaError(replay, 'invalid_state');
    });
  });

  describe('FRONTEND_URL default', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp({});
    });

    afterAll(async () => {
      await app?.close();
    });

    it('uses http://localhost:5173 when FRONTEND_URL is unset', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ error: 'access_denied' })
        .redirects(0);

      expectSpaError(res, 'invalid_state', 'http://localhost:5173');
    });
  });

  describe('controller hash mapping', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp({ frontendUrl: 'http://localhost:5173/', stubGuard: true });
    });

    afterAll(async () => {
      await app?.close();
    });

    beforeEach(() => {
      jest.resetAllMocks();
      googleUser = {
        providerUserId: 'google-123',
        email: 'Ada@Example.com',
        name: 'Ada',
        avatarUrl: 'https://photo.example/ada',
      };
      prismaMock.organization.findUnique.mockResolvedValue({
        id: ORG_ID,
        slug: 'klass-42',
        status: 'ACTIVE',
      });
      prismaMock.session.create.mockResolvedValue({ id: 'session-http-1' });
      prismaMock.session.update.mockResolvedValue({ id: 'session-http-1' });
    });

    it('redirects tokens when the Google account is already linked in that organization', async () => {
      prismaMock.oAuthAccount.findUnique.mockResolvedValue({
        userId: 'user-ada',
        user: { organizationId: ORG_ID },
      });

      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ state: 'klass-42' })
        .redirects(0);

      expect(res.status).toBe(302);
      const url = new URL(locationOf(res));
      expect(`${url.origin}${url.pathname}`).toBe('http://localhost:5173/auth/callback');
      const hash = new URLSearchParams(url.hash.slice(1));
      expect(hash.get('error')).toBeNull();
      expect(hash.get('accessToken')?.length).toBeGreaterThan(10);
      expect(hash.get('refreshToken')?.length).toBeGreaterThan(10);
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'klass-42' },
      });
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('uses the first state value when the query repeats it', async () => {
      prismaMock.oAuthAccount.findUnique.mockResolvedValue({
        userId: 'user-ada',
        user: { organizationId: ORG_ID },
      });

      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ state: ['klass-42', 'other-org'] })
        .redirects(0);

      expect(res.status).toBe(302);
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'klass-42' },
      });
      expect(locationOf(res)).toContain('#accessToken=');
    });

    it('maps a missing organization to unknown_organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ state: 'missing' })
        .redirects(0);

      expectSpaError(res, 'unknown_organization');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('maps an inactive organization to unknown_organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: ORG_ID,
        slug: 'klass-42',
        status: 'SUSPENDED',
      });

      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ state: 'klass-42' })
        .redirects(0);

      expectSpaError(res, 'unknown_organization');
      expect(prismaMock.oAuthAccount.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('maps a blank Google email to unknown_organization without creating records', async () => {
      googleUser = { ...googleUser, email: '   ' };

      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ state: 'klass-42' })
        .redirects(0);

      expectSpaError(res, 'unknown_organization');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('maps a Google account linked to another organization to wrong_organization', async () => {
      prismaMock.oAuthAccount.findUnique.mockResolvedValue({
        userId: 'user-other',
        user: { organizationId: 'org-other' },
      });

      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ state: 'klass-42' })
        .redirects(0);

      expectSpaError(res, 'wrong_organization');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('maps an unexpected failure to oauth_failed', async () => {
      prismaMock.organization.findUnique.mockRejectedValue(new Error('database unavailable'));

      const res = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ state: 'klass-42' })
        .redirects(0);

      expectSpaError(res, 'oauth_failed');
    });
  });
});
