import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Payload for {@link NotificationsService.emit}. */
export interface EmitPayload {
  title: string;
  body?: string;
  link?: string;
}

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a notification for `userId`. Returns the persisted row so callers
   * can log/inspect it.
   */
  async emit(userId: string, type: NotificationType, payload: EmitPayload) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: payload.title,
        body: payload.body,
        link: payload.link,
      },
    });

    // TODO(Epic E): push por socket
    return notification;
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
