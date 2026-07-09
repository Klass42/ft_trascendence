import type { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

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
  let port: number;
  const clients: Socket[] = [];

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
    user: { update: async () => ({}) },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        RealtimeGateway,
        NotificationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0);

    const address = (app.getHttpServer() as { address(): { port: number } }).address();
    port = address.port;
    notifications = moduleRef.get(NotificationsService);
  });

  afterAll(async () => {
    for (const c of clients) c.close();
    await app.close();
  });

  function connect(userId: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`http://localhost:${port}`, {
        auth: { userId },
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
