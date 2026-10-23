import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** App-bus event fired after a notification is persisted (see RealtimeGateway). */
export const NOTIFICATION_CREATED = 'notification.created';

/** Payload for {@link NotificationsService.emit}. */
export interface EmitPayload {
  title: string;
  body?: string;
  link?: string;
}

export interface EmitManyOptions {
  organizationId?: string;
  actorId?: string;
}

export type NotificationRecipientLoader = () => Promise<readonly string[]>;

/** Options for {@link NotificationsService.listMine}. */
export interface ListMineOptions {
  page?: number;
  pageSize?: number;
}

/**
 * Central notification service. Every other epic (assignments, grading, forums)
 * injects this and calls `emit()` to notify a user. For now `emit()` only
 * persists; Epic E enches it to also push over a socket in real time.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Create a notification for `userId`. Returns the persisted row so callers
   * can log/inspect it.
   */
  async emit(userId: string, type: NotificationType, payload: EmitPayload) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type,
          title: payload.title,
          body: payload.body,
          link: payload.link,
        },
      });

      // RealtimeGateway escucha el bus y publica en la sala del usuario.
      this.events.emit(NOTIFICATION_CREATED, notification);
      return notification;
    } catch (error) {
      this.logger.error(`No se pudo emitir ${type} para ${userId}`, error instanceof Error ? error.stack : undefined);
      return null;
    }
  }

  /**
   * Notify a de-duplicated set of users after the main action has completed.
   * When an organization is supplied, re-resolve recipients inside that tenant
   * before emitting so callers cannot accidentally cross organization bounds.
   */
  async emitMany(
    userIds: readonly string[] | NotificationRecipientLoader,
    type: NotificationType,
    payload: EmitPayload,
    options: EmitManyOptions = {},
  ): Promise<void> {
    try {
      const resolvedIds = typeof userIds === 'function' ? await userIds() : userIds;
      let recipients = [...new Set(resolvedIds.filter(Boolean))];
      if (options.actorId) recipients = recipients.filter((id) => id !== options.actorId);
      if (options.organizationId && recipients.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { id: { in: recipients }, organizationId: options.organizationId },
          select: { id: true },
        });
        recipients = users.map((user) => user.id);
      }
      await Promise.all(recipients.map((userId) => this.emit(userId, type, payload)));
    } catch (error) {
      this.logger.error(`No se pudo emitir ${type} a varios usuarios`, error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * List the notifications that belong to `userId`, newest first, paginated.
   * Scoped by `userId` — a user never sees another user's notifications.
   */
  async listMine(userId: string, { page = 1, pageSize = 20 }: ListMineOptions = {}) {
    const skip = (page - 1) * pageSize;

    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { items, page, pageSize, total, unread };
  }

  /**
   * Mark a single notification read. The `userId` in the `where` clause makes
   * this a no-op for notifications the user does not own — no leaking across
   * users.
   */
  async markRead(id: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return { updated: result.count };
  }

  /** Mark every unread notification of `userId` as read. */
  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { updated: result.count };
  }
}
