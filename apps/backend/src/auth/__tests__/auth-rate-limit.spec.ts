import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CommonModule } from '@/common/common.module';
import { AuthModule } from '../auth.module';

const prismaMock = {
  organization: { findUnique: jest.fn() },
  user: { findFirst: jest.fn().mockResolvedValue(null) },
  session: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
};

describe('Auth rate limits HTTP', () => {
  let app: INestApplication;
  const previousEnv = { ...process.env };

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.AUTH_RATE_LIMIT_LOGIN_IP = '3';
    process.env.AUTH_RATE_LIMIT_LOGIN_EMAIL = '1';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        CommonModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const key of Object.keys(process.env)) {
      if (!(key in previousEnv)) delete process.env[key];
    }
    Object.assign(process.env, previousEnv);
  });

  it('limits login by IP and email and returns Retry-After', async () => {
    const login = (email: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ organizationSlug: 'klass', email, password: 'WrongPassword1' });

    await expect(login('same@example.com')).resolves.toMatchObject({ status: 401 });

    const limited = await login('same@example.com');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    // The per-IP bucket still has capacity; another email has its own account bucket.
    await expect(login('other@example.com')).resolves.toMatchObject({ status: 401 });
  });

  it('disables auth limits under NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'test';
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ organizationSlug: 'klass', email: 'same@example.com', password: 'WrongPassword1' });

    expect(response.status).toBe(401);
  });
});
