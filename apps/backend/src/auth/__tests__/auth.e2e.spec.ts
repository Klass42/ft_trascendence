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
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CommonModule } from '@/common/common.module';
import { AuthModule } from '../auth.module';
import { IS_PUBLIC_KEY } from '@/common/auth/public.decorator';
import type { AuthUser } from '@/common/auth/auth-user.type';

const mockUser = {
  id: 'user-student-0001',
  organizationId: 'org-klass-0001',
  email: 'student@demo.com',
  passwordHash: '',
  name: 'Sam Student',
  avatarUrl: null,
  role: 'STUDENT' as const,
  onlineAt: null,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prismaMock = {
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
};

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
          organizationId: user.organizationId,
          role: user.role,
          emailNotificationsEnabled: user.emailNotificationsEnabled,
          preferredLanguage: user.preferredLanguage,
        };
        return true;
      }
    }
    throw new UnauthorizedException();
  }
}

describe('Auth E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        CommonModule,
        AuthModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: TestAuthGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('POST /auth/login returns user + tokens on valid credentials', async () => {
    const hash = await argon2.hash('demo1234');
    prismaMock.user.findFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });
    prismaMock.session.create.mockResolvedValue({ id: 'session-1' });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'student@demo.com', password: 'demo1234' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toHaveProperty('userId', 'user-student-0001');
    expect(res.body.user).toHaveProperty('organizationId', 'org-klass-0001');
    expect(res.body.user).toHaveProperty('role', 'STUDENT');
  });

  it('POST /auth/login returns 401 on wrong password', async () => {
    const hash = await argon2.hash('demo1234');
    prismaMock.user.findFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'student@demo.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('GET /auth/me without token returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me with x-dev-user returns AuthUser in dev mode', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('x-dev-user', 'user-student-0001');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId', 'user-student-0001');
  });

  it('POST /auth/register rejects weak passwords', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'new@demo.com', password: 'weak', name: 'New User' });

    expect(res.status).toBe(400);
  });
});
