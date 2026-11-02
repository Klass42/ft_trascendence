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
  /** Return only unread notifications (`total` then counts only those). */
  unreadOnly?: boolean;
}

/**
 * Link patterns of the notifications that point at a deleted entity.
 * `equals`/`startsWith`/`endsWith` are OR-ed together.
 */
export interface LinkMatchers {
  equals?: string[];
  startsWith?: string[];
  endsWith?: string[];
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
      return await this.persist(userId, type, payload);
    } catch (error) {
      this.logger.error(`No se pudo emitir ${type} para ${userId}`, error instanceof Error ? error.stack : undefined);
      return null;
    }
  }

  private async persist(userId: string, type: NotificationType, payload: EmitPayload) {
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
  }

  /**
   * Notify a de-duplicated set of users after the main action has completed.
   * When an organization is supplied, re-resolve recipients inside that tenant
   * before emitting so callers cannot accidentally cross organization bounds.
   * Deactivated accounts (#134) are dropped from that same query.
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
        // #134: deactivated accounts get nothing while they are out of the organization.
        const users = await this.prisma.user.findMany({
          where: { id: { in: recipients }, organizationId: options.organizationId, deactivatedAt: null },
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
  async listMine(userId: string, { page = 1, pageSize = 20, unreadOnly = false }: ListMineOptions = {}) {
    const skip = (page - 1) * pageSize;
    const where = unreadOnly ? { userId, read: false } : { userId };

    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        // `id` breaks ties so rows created in the same ms keep a stable page order.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
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
      throw new NotFoundException('Notificación no encontrada.');
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

  /**
   * Delete the notifications of `organizationId` whose link points at an entity
   * that no longer exists, so they never open a 404. The recipient's
   * organization is part of the filter: `Notification` has no tenant column.
   * Best effort — the delete that triggered it must not fail because of this.
   */
  async removeByLink(organizationId: string, matchers: LinkMatchers): Promise<number> {
    const link = [
      ...(matchers.equals ?? []).map((value) => ({ link: value })),
      ...(matchers.startsWith ?? []).map((value) => ({ link: { startsWith: value } })),
      ...(matchers.endsWith ?? []).map((value) => ({ link: { endsWith: value } })),
    ];
    if (link.length === 0) return 0;
    try {
      const result = await this.prisma.notification.deleteMany({
        where: { user: { organizationId }, OR: link },
      });
      return result.count;
    } catch (error) {
      this.logger.error('No se pudieron limpiar las notificaciones de un elemento eliminado', error instanceof Error ? error.stack : undefined);
      return 0;
    }
  }
}
