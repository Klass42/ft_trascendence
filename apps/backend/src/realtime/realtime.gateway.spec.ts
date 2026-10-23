import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ANALYTICS_UPDATED } from '../analytics/analytics.events';
import { RealtimeGateway } from './realtime.gateway';

// Same secret the gateway verifies with (ConfigService mock returns it below).
const TEST_ACCESS_SECRET = 'test-access-secret';

/**
 * Integration test for the realtime path with a REAL Socket.io server and
 * client (Prisma is mocked, so no database is needed). It proves the full
 * loop the DoD demands: NotificationsService.emit() → event bus → gateway →
 * `notification:new` delivered only to the recipient's room. This is the
 * single-process stand-in for the "two browsers" manual check.
 */
describe('RealtimeGateway (integration)', () => {
  let app: INestApplication;
  let notifications: NotificationsService;
  let events: EventEmitter2;
  let jwt: JwtService;
  let port: number;
  const clients: Socket[] = [];

  // p-alice and p-bob are ACCEPTED friends; everyone else has no friends.
  const FRIENDS = new Set(['p-alice', 'p-bob']);
  const prismaMock = {
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: `n-${Math.round(Math.random() * 1e9)}`,
        read: false,
        createdAt: new Date(),
        ...data,
      }),
    },
    // presence stamp (connect/disconnect) — accept and ignore
    user: {
      update: async () => ({}),
      findMany: jest.fn(async () => [{ id: 'analytics-admin' }]),
    },
    subjectStaff: {
      findMany: jest.fn(async () => [{ userId: 'analytics-teacher' }]),
    },
    friendship: {
      findMany: async ({ where }: { where: any }) => {
        const uid = where.OR?.[0]?.requesterId as string | undefined;
        if (uid && FRIENDS.has(uid)) {
          return [{ requesterId: 'p-alice', addresseeId: 'p-bob' }];
        }
        return [];
      },
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        JwtModule.register({ secret: TEST_ACCESS_SECRET }),
      ],
      providers: [
        RealtimeGateway,
        NotificationsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => TEST_ACCESS_SECRET },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0);

    const address = (app.getHttpServer() as { address(): { port: number } }).address();
    port = address.port;
    notifications = moduleRef.get(NotificationsService);
    events = moduleRef.get(EventEmitter2);
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    for (const c of clients) c.close();
    await app.close();
  });

  function connect(userId: string): Promise<Socket> {
    return connectWith({ userId });
  }

  function connectWith(auth: Record<string, unknown>): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`http://localhost:${port}`, {
        auth,
        transports: ['websocket'],
        reconnection: false,
      });
      clients.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  it('pushes notification:new to the recipient in real time', async () => {
    const alice = await connect('user-alice');
    const received = new Promise<{ title: string; userId: string }>((resolve) =>
      alice.on('notification:new', resolve),
    );

    await notifications.emit('user-alice', NotificationType.SYSTEM, {
      title: 'Hi Alice',
      body: 'live',
    });

    const payload = await received;
    expect(payload.title).toBe('Hi Alice');
    expect(payload.userId).toBe('user-alice');
    alice.close();
  });

  it('pushes analytics:update only to course staff and organization admins', async () => {
    const teacher = await connect('analytics-teacher');
    const admin = await connect('analytics-admin');
    const student = await connect('analytics-student');
    let studentReceived = false;
    const teacherReceived = new Promise<{ courseId: string }>((resolve) =>
      teacher.on('analytics:update', resolve),
    );
    const adminReceived = new Promise<{ courseId: string }>((resolve) =>
      admin.on('analytics:update', resolve),
    );
    student.on('analytics:update', () => {
      studentReceived = true;
    });

    events.emit(ANALYTICS_UPDATED, {
      courseId: 'subject-web-101',
      organizationId: 'org-klass-0001',
    });

    await expect(teacherReceived).resolves.toEqual({ courseId: 'subject-web-101' });
    await expect(adminReceived).resolves.toEqual({ courseId: 'subject-web-101' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(studentReceived).toBe(false);
    expect(prismaMock.subjectStaff.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        subjectId: 'subject-web-101',
        subject: { organizationId: 'org-klass-0001' },
      },
    }));
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-klass-0001', role: 'ADMIN' },
      select: { id: true },
    });
  });

  it('broadcasts presence:update online to a friend when a user connects', async () => {
    // Bob comes online first and listens; Alice (his friend) then connects.
    const bob = await connect('p-bob');
    const online = new Promise<{ userId: string; online: boolean }>((resolve) =>
      bob.on('presence:update', resolve),
    );

    const alice = await connect('p-alice');

    const payload = await online;
    expect(payload).toEqual({ userId: 'p-alice', online: true });

    // When Alice disconnects, Bob is told she went offline.
    const offline = new Promise<{ userId: string; online: boolean }>((resolve) =>
      bob.on('presence:update', resolve),
    );
    alice.close();
    const off = await offline;
    expect(off).toEqual({ userId: 'p-alice', online: false });

    bob.close();
  });

  it('does not send presence to non-friends', async () => {
    // Carol is nobody's friend; Dave connecting must not reach her.
    const carol = await connect('p-carol');
    let leaked = false;
    carol.on('presence:update', () => {
      leaked = true;
    });

    const dave = await connect('p-dave');
    await new Promise((r) => setTimeout(r, 150));

    expect(leaked).toBe(false);
    carol.close();
    dave.close();
  });

  it("does not deliver a notification to a different user's socket", async () => {
    const bob = await connect('user-bob');
    let leaked = false;
    bob.on('notification:new', () => {
      leaked = true;
    });

    await notifications.emit('user-alice', NotificationType.SYSTEM, {
      title: 'For Alice only',
    });
    // give any (erroneous) delivery time to arrive
    await new Promise((r) => setTimeout(r, 150));

    expect(leaked).toBe(false);
    bob.close();
  });

  it('accepts a socket carrying a valid access JWT and delivers to its sub', async () => {
    const token = jwt.sign({ sub: 'user-jwt' }, { secret: TEST_ACCESS_SECRET });
    const carol = await connectWith({ token });
    const received = new Promise<{ title: string; userId: string }>((resolve) =>
      carol.on('notification:new', resolve),
    );

    await notifications.emit('user-jwt', NotificationType.SYSTEM, {
      title: 'Hi JWT',
    });

    const payload = await received;
    expect(payload.title).toBe('Hi JWT');
    expect(payload.userId).toBe('user-jwt');
    carol.close();
  });

  it('rejects a socket with an invalid access JWT', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const socket = io(`http://localhost:${port}`, {
          auth: { token: 'not-a-real-jwt' },
          transports: ['websocket'],
          reconnection: false,
        });
        clients.push(socket);
        socket.on('disconnect', () => resolve('disconnected'));
        socket.on('connect_error', reject);
        setTimeout(() => reject(new Error('still connected')), 1500);
      }),
    ).resolves.toBe('disconnected');
  });

  it('rejects a socket with no identity', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const socket = io(`http://localhost:${port}`, {
          transports: ['websocket'],
          reconnection: false,
        });
        clients.push(socket);
        // The gateway disconnects us immediately after connecting.
        socket.on('disconnect', () => resolve('disconnected'));
        socket.on('connect_error', reject);
        setTimeout(() => reject(new Error('still connected')), 1500);
      }),
    ).resolves.toBe('disconnected');
  });
});
