import type { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { NotificationsService, NOTIFICATION_CREATED } from './notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

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
          .filter((r) => where.read === undefined || r.read === where.read)
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

  it('emitMany scopes recipients to the organization, removes the actor, and de-duplicates users', async () => {
    const create = jest.fn(async ({ data }: any) => ({ id: 'n-1', ...data }));
    const findMany = jest.fn(async ({ where }: any) =>
      where.organizationId === 'org-one' && where.id.in.includes('target')
        ? [{ id: 'target' }]
        : [],
    );
    const service = new NotificationsService(
      { user: { findMany }, notification: { create, findMany: jest.fn(async () => []) } } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    await service.emitMany(
      ['actor', 'target', 'target', 'other-org-user'],
      NotificationType.COURSE_CONTENT_CHANGED,
      { title: 'Nuevo contenido' },
      { organizationId: 'org-one', actorId: 'actor' },
    );

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['target', 'other-org-user'] }, organizationId: 'org-one', deactivatedAt: null },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'target', type: NotificationType.COURSE_CONTENT_CHANGED }),
    });
  });

  it('#134 emitMany never notifies deactivated accounts', async () => {
    const create = jest.fn(async ({ data }: any) => ({ id: 'n-1', ...data }));
    const users = [{ id: 'active', deactivatedAt: null }, { id: 'gone', deactivatedAt: new Date() }];
    const findMany = jest.fn(async ({ where }: any) =>
      users.filter((u) => where.id.in.includes(u.id) && (where.deactivatedAt === null ? u.deactivatedAt === null : true)).map(({ id }) => ({ id })),
    );
    const service = new NotificationsService(
      { user: { findMany }, notification: { create } } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    await service.emitMany(['active', 'gone'], NotificationType.USER_CHANGED, { title: 'Aviso' }, { organizationId: 'org-one' });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deactivatedAt: null }) }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'active' }) });
  });

  it('notification persistence failures do not reject emitMany or its caller', async () => {
    const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const service = new NotificationsService(
      {
        user: { findMany: jest.fn(async () => [{ id: 'target' }]) },
        notification: {
          findMany: jest.fn(async () => []),
          create: jest.fn(async () => { throw new Error('database unavailable'); }),
        },
      } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    await expect(service.emitMany(
      ['target'],
      NotificationType.USER_CHANGED,
      { title: 'Cambio de cuenta' },
      { organizationId: 'org-one' },
    )).resolves.toBeUndefined();

    expect(loggerError).toHaveBeenCalled();
    loggerError.mockRestore();
  });

  describe('listMine', () => {
    function build() {
      const findMany = jest.fn(async () => []);
      const count = jest.fn(async () => 0);
      const service = new NotificationsService(
        { notification: { findMany, count }, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) } as unknown as PrismaService,
        { emit: jest.fn() } as unknown as EventEmitter2,
      );
      return { service, findMany, count };
    }

    it('filters by unread, pages with a stable order, and keeps the global unread count', async () => {
      const { service, findMany, count } = build();

      await service.listMine('lucia', { page: 3, pageSize: 10, unreadOnly: true });

      expect(findMany).toHaveBeenCalledWith({
        where: { userId: 'lucia', read: false },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 20,
        take: 10,
      });
      expect(count).toHaveBeenNthCalledWith(1, { where: { userId: 'lucia', read: false } });
      expect(count).toHaveBeenNthCalledWith(2, { where: { userId: 'lucia', read: false } });
    });

    it('lists everything of the caller by default', async () => {
      const { service, findMany, count } = build();

      const result = await service.listMine('lucia');

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'lucia' }, skip: 0, take: 20 }));
      expect(count).toHaveBeenNthCalledWith(1, { where: { userId: 'lucia' } });
      expect(result).toMatchObject({ page: 1, pageSize: 20 });
    });
  });

  describe('removeByLink', () => {
    it('deletes only the organization notifications that match any link pattern', async () => {
      const deleteMany = jest.fn(async () => ({ count: 3 }));
      const service = new NotificationsService(
        { notification: { deleteMany } } as unknown as PrismaService,
        { emit: jest.fn() } as unknown as EventEmitter2,
      );

      const removed = await service.removeByLink('org-one', {
        equals: ['/forums/t1'],
        startsWith: ['/activities?subjectId=s1&'],
        endsWith: ['activityId=a1'],
      });

      expect(removed).toBe(3);
      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          user: { organizationId: 'org-one' },
          OR: [
            { link: '/forums/t1' },
            { link: { startsWith: '/activities?subjectId=s1&' } },
            { link: { endsWith: 'activityId=a1' } },
          ],
        },
      });
    });

    it('does nothing without patterns and never throws', async () => {
      const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const deleteMany = jest.fn(async () => { throw new Error('db down'); });
      const service = new NotificationsService(
        { notification: { deleteMany } } as unknown as PrismaService,
        { emit: jest.fn() } as unknown as EventEmitter2,
      );

      await expect(service.removeByLink('org-one', {})).resolves.toBe(0);
      expect(deleteMany).not.toHaveBeenCalled();
      await expect(service.removeByLink('org-one', { equals: ['/forums/t1'] })).resolves.toBe(0);
      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });
});
