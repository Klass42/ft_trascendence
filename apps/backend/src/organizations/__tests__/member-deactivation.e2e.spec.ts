/**
 * #134 end-to-end over HTTP: admin removes a member (= deactivate) → the member
 * cannot sign in → admin reactivates → the member signs in again with the same
 * account (same id, so submissions/grades are still theirs). Prisma is a small
 * in-memory fake so the flow runs without a database.
 */
import { Test } from '@nestjs/testing';
import { CanActivate, ExecutionContext, INestApplication, Injectable, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CommonModule } from '@/common/common.module';
import { IS_PUBLIC_KEY } from '@/common/auth/public.decorator';
import type { AuthUser } from '@/common/auth/auth-user.type';
import { USER_DEACTIVATED } from '@/realtime/realtime.events';
import { AuthModule } from '@/auth/auth.module';
import { OrganizationsModule } from '../organizations.module';

const ORG = 'org-klass-0001';
type Row = Record<string, any>;
const users: Record<string, Row> = {};
const base = { organizationId: ORG, avatarUrl: null, bio: null, platformRole: 'NONE', onlineAt: null, emailVerifiedAt: new Date(), emailNotificationsEnabled: true, preferredLanguage: 'es', deactivatedAt: null, createdAt: new Date(), updatedAt: new Date() };

const sessions: Row[] = [];
const prismaMock: any = {
  organization: { findUnique: jest.fn(async () => ({ id: ORG, slug: 'klass', status: 'ACTIVE', maxUsers: null })) },
  user: {
    findUnique: jest.fn(async ({ where }: any) => users[where.id] ?? null),
    findFirst: jest.fn(async ({ where }: any) => {
      const u = Object.values(users).find((x) => x.email === where.email);
      return u ? { ...u, organization: { status: 'ACTIVE' } } : null;
    }),
    findMany: jest.fn(async () => []),
    update: jest.fn(async ({ where, data }: any) => Object.assign(users[where.id], data)),
    count: jest.fn(async () => 0),
  },
  session: {
    create: jest.fn(async ({ data }: any) => { const s = { id: `s${sessions.length}`, ...data }; sessions.push(s); return s; }),
    update: jest.fn(async () => ({})),
    deleteMany: jest.fn(async ({ where }: any) => { const before = sessions.length; for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].userId === where.userId) sessions.splice(i, 1); return { count: before - sessions.length }; }),
  },
  courseMembership: { deleteMany: jest.fn(async () => ({ count: 1 })) },
  subjectStaff: { deleteMany: jest.fn(async () => ({ count: 0 })) },
  auditLog: { create: jest.fn(async () => ({})) },
  notification: { createMany: jest.fn(async () => ({ count: 0 })) },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const u = users[req.headers['x-dev-user']];
    if (!u) throw new UnauthorizedException();
    req.user = { userId: u.id, email: u.email, name: u.name, avatarUrl: null, organizationId: ORG, role: u.role, platformRole: 'NONE', emailNotificationsEnabled: true, preferredLanguage: 'es' } as AuthUser;
    return true;
  }
}

describe('#134 remove member = deactivate (HTTP)', () => {
  let app: INestApplication;
  let events: EventEmitter2;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    const hash = await argon2.hash('demo1234');
    users.admin = { ...base, id: 'admin', email: 'admin@demo', name: 'Ada', role: 'ADMIN', passwordHash: hash };
    users.sam = { ...base, id: 'sam', email: 'student@demo', name: 'Sam', role: 'STUDENT', passwordHash: hash };
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule, CommonModule, AuthModule, OrganizationsModule],
      providers: [{ provide: APP_GUARD, useClass: TestAuthGuard }],
    }).overrideProvider(PrismaService).useValue(prismaMock).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    events = moduleRef.get(EventEmitter2);
  });

  afterAll(async () => { await app?.close(); });

  const login = () => request(app.getHttpServer()).post('/auth/login').send({ organizationSlug: 'klass', email: 'student@demo', password: 'demo1234' });

  it('remove → cannot log in → reactivate → logs in as the same account', async () => {
    expect((await login()).status).toBe(201);
    expect(sessions.some((s) => s.userId === 'sam')).toBe(true);

    const seen: unknown[] = [];
    events.on(USER_DEACTIVATED, (payload) => seen.push(payload));

    await request(app.getHttpServer()).delete(`/organizations/${ORG}/members/sam`).set('x-dev-user', 'admin').expect(204);
    expect(users.sam).toBeDefined();
    expect(users.sam.deactivatedAt).toBeInstanceOf(Date);
    expect(sessions.some((s) => s.userId === 'sam')).toBe(false);
    expect(seen).toEqual([{ userId: 'sam' }]);

    const blocked = await login();
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/desactivado/);

    await request(app.getHttpServer()).post(`/organizations/${ORG}/members/sam/reactivate`).set('x-dev-user', 'admin').expect(201);
    expect(users.sam.deactivatedAt).toBeNull();

    const again = await login();
    expect(again.status).toBe(201);
    expect(again.body.user.userId).toBe('sam');
  });

  it('a student cannot remove or reactivate members', async () => {
    await request(app.getHttpServer()).delete(`/organizations/${ORG}/members/admin`).set('x-dev-user', 'sam').expect(403);
    await request(app.getHttpServer()).post(`/organizations/${ORG}/members/admin/reactivate`).set('x-dev-user', 'sam').expect(403);
  });
});
