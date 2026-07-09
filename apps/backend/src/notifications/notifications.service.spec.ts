import type { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { NotificationsService, NOTIFICATION_CREATED } from './notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Happy-path unit test for the notifications service. Uses a tiny in-memory
 * fake of the two Prisma methods `emit`/`listMine` touch, so it runs without a
 * database. Verifies that emit persists a row and listMine returns only the
 * caller's notifications, newest first, with the right counts.
 */
describe('NotificationsService', () => {
  function buildPrismaFake() {
    const store: Array<Record<string, any>> = [];
    let seq = 0;

    const notification = {
      create: async ({ data }: any) => {
        seq += 1;
        const row = {
          id: `n-${seq}`,
          read: false,
          // monotonically increasing so createdAt ordering is deterministic
          createdAt: new Date(2026, 0, 1, 0, 0, seq),
          ...data,
        };
        store.push(row);
        return row;
      },
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        return store
          .filter((r) => r.userId === where.userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip, skip + take);
      },
      count: async ({ where }: any) =>
        store.filter(
          (r) =>
            r.userId === where.userId &&
            (where.read === undefined || r.read === where.read),
        ).length,
    };

    return {
      notification,
      // service calls $transaction([...]) with already-issued promises
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    } as unknown as PrismaService;
  }

  it('emit persists a notification and listMine returns it scoped to the user', async () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const events = {
      emit: (event: string, payload: unknown) => {
        emitted.push({ event, payload });
        return true;
      },
    } as unknown as EventEmitter2;
    const service = new NotificationsService(buildPrismaFake(), events);

    const created = await service.emit('user-lucia-001', NotificationType.SYSTEM, {
      title: 'Welcome',
      body: 'Your account is ready',
    });

    // Epic E: emit() must publish the persisted row on the bus so the realtime
    // gateway can push it. Decoupled — asserted here without a live socket.
    expect(emitted).toContainEqual({
      event: NOTIFICATION_CREATED,
      payload: created,
    });
    // a notification for someone else must not leak into Lucia's list
    await service.emit('user-diego-001', NotificationType.SYSTEM, {
      title: 'Not yours',
    });

    const result = await service.listMine('user-lucia-001', {
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(1);
    expect(result.unread).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Welcome');
    expect(result.items[0].userId).toBe('user-lucia-001');
  });
});
