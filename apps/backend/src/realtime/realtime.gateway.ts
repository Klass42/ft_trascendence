import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Notification } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { ANALYTICS_UPDATED, AnalyticsUpdatedEvent } from '../analytics/analytics.events';
import { PrismaService } from '../prisma/prisma.service';
import {
  ORGANIZATION_SUSPENDED,
  OrganizationSuspendedEvent,
  USER_DEACTIVATED,
  UserDeactivatedEvent,
} from './realtime.events';

// Same origin the HTTP layer allows (see main.ts). In dev the frontend also
// proxies /socket.io through Vite, so most connections arrive same-origin; this
// keeps direct ws://localhost:3000 clients working too.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/** The Socket.io room a given user's live connections all join. */
function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** The Socket.io room all live connections of an organization's members join. */
function orgRoom(organizationId: string): string {
  return `org:${organizationId}`;
}

/**
 * Real-time gateway (Real-time WebSockets module).
 *
 * - One room per user (`user:<id>`); every tab/device the user opens joins it.
 * - Pushes `notification:new` to a user when NotificationsService persists one.
 *   It stays fully decoupled: the service fires a `notification.created` event
 *   on the app event bus and this gateway reacts with `@OnEvent`. No module
 *   imports NotificationsService <-> RealtimeModule either way, so there is no
 *   circular dependency and `emit()` is a safe no-op when nobody is connected.
 * - Access: on connect the user must still exist and belong to an ACTIVE
 *   organization (same rule as JwtStrategy). `organization.suspended` and
 *   `user.deactivated` events (see realtime.events.ts) disconnect live sockets
 *   at once; members also join `org:<id>`, which lets us cut a whole org
 *   without a DB query (needed when it was deleted and its users are gone).
 * - Presence: stamps `User.onlineAt` on connect/disconnect (last-seen) AND
 *   broadcasts `presence:update` {userId, online} to the user's accepted
 *   friends on the online↔offline transition (first socket up / last down).
 *   Live sockets are counted in-memory per user (single-process MVP), so extra
 *   tabs don't spam friends and only real transitions are emitted.
 */
@WebSocketGateway({
  cors: { origin: FRONTEND_URL, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  /** userId → number of live sockets. A user is "online" while this is > 0. */
  private readonly connections = new Map<string, number>();

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const userId = this.identify(client);
    if (!userId) {
      // No valid identity → refuse the socket rather than leave it anonymous.
      this.logger.warn(`Socket ${client.id} rejected: missing user identity`);
      client.disconnect(true);
      return;
    }

    const access = await this.authorize(userId);
    if (!access) {
      this.logger.warn(`Socket ${client.id} rejected: user gone or organization not active`);
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    await client.join(userRoom(userId));
    if (access.organizationId) await client.join(orgRoom(access.organizationId));
    await this.touchOnline(userId);

    const wentOnline = this.addConnection(userId);
    if (wentOnline) {
      await this.broadcastPresence(userId, true);
    }
    this.logger.log(`Socket ${client.id} connected as ${userId}`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    await this.touchOnline(userId);

    const wentOffline = this.removeConnection(userId);
    if (wentOffline) {
      await this.broadcastPresence(userId, false);
    }
    this.logger.log(`Socket ${client.id} (${userId}) disconnected`);
  }

  /** True when the user has at least one live socket right now. */
  isOnline(userId: string): boolean {
    return (this.connections.get(userId) ?? 0) > 0;
  }

  /** Register a socket; returns true on the 0→1 (offline→online) transition. */
  private addConnection(userId: string): boolean {
    const next = (this.connections.get(userId) ?? 0) + 1;
    this.connections.set(userId, next);
    return next === 1;
  }

  /** Deregister a socket; returns true on the 1→0 (online→offline) transition. */
  private removeConnection(userId: string): boolean {
    const next = (this.connections.get(userId) ?? 1) - 1;
    if (next <= 0) {
      this.connections.delete(userId);
      return true;
    }
    this.connections.set(userId, next);
    return false;
  }

  /**
   * Emit `presence:update` to every accepted friend of `userId`. `to(room)` is
   * a no-op for friends with no live socket, so this is safe for offline peers.
   */
  private async broadcastPresence(
    userId: string,
    online: boolean,
  ): Promise<void> {
    try {
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });
      if (!actor?.organizationId) return;
      const friendIds = await this.getAcceptedFriendIds(userId, actor.organizationId);
      for (const friendId of friendIds) {
        this.server
          ?.to(userRoom(friendId))
          .emit('presence:update', { userId, online });
      }
    } catch (err) {
      // Presence is best-effort; a query hiccup must not break the socket.
      this.logger.warn(
        `presence broadcast failed for ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Ids of users who are ACCEPTED friends of `userId` (friendship is symmetric,
   * so look at both sides of the relation).
   */
  async getAcceptedFriendIds(userId: string, organizationId: string): Promise<string[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        requester: { is: { organizationId } },
        addressee: { is: { organizationId } },
      },
      select: { requesterId: true, addresseeId: true },
    });
    return friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId,
    );
  }

  /**
   * Push a freshly created notification to its recipient in real time. Fired by
   * NotificationsService.emit() through the event bus. `to(room)` is a no-op
   * when the user has no live socket, so this never fails for offline users.
   */
  @OnEvent('notification.created')
  handleNotificationCreated(notification: Notification): void {
    this.server
      ?.to(userRoom(notification.userId))
      .emit('notification:new', notification);
  }

  /** Push analytics invalidations only to staff in the subject's organization. */
  @OnEvent(ANALYTICS_UPDATED)
  async handleAnalyticsUpdated({ courseId, organizationId }: AnalyticsUpdatedEvent): Promise<void> {
    try {
      const [staff, admins] = await Promise.all([
        this.prisma.subjectStaff.findMany({
          where: {
            subjectId: courseId,
            subject: { organizationId },
          },
          select: { userId: true },
        }),
        this.prisma.user.findMany({
          where: { organizationId, role: 'ADMIN' },
          select: { id: true },
        }),
      ]);
      const userIds = new Set([
        ...staff.map(({ userId }) => userId),
        ...admins.map(({ id }) => id),
      ]);

      for (const userId of userIds) {
        this.server
          ?.to(userRoom(userId))
          .emit('analytics:update', { courseId });
      }
    } catch (error) {
      this.logger.warn(`Analytics update broadcast failed for ${courseId}: ${String(error)}`);
    }
  }

  /** Disconnect every socket of an organization that was suspended, archived or deleted. */
  @OnEvent(ORGANIZATION_SUSPENDED)
  handleOrganizationSuspended({ organizationId }: OrganizationSuspendedEvent): void {
    this.server?.in(orgRoom(organizationId)).disconnectSockets(true);
  }

  /** Disconnect every socket of a user whose access was revoked (deactivated or deleted). */
  @OnEvent(USER_DEACTIVATED)
  handleUserDeactivated({ userId }: UserDeactivatedEvent): void {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }

  /**
   * Connect-time access check, mirroring JwtStrategy.validate: the user must
   * still exist and their organization (if any; platform users have none) must
   * be ACTIVE. Fails closed: a query error rejects the socket (the client
   * retries). When #134 adds `User.deactivatedAt`, reject it here too.
   */
  private async authorize(userId: string): Promise<{ organizationId: string | null } | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true, organization: { select: { status: true } } },
      });
      if (!user) return null;
      if (user.organization && user.organization.status !== 'ACTIVE') return null;
      return { organizationId: user.organizationId };
    } catch (err) {
      this.logger.warn(`access check failed for ${userId}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Resolve the acting user from the Socket.io handshake.
   *
   * Prod contract (mirrors AppAuthGuard): verify a REAL access JWT from
   * `handshake.auth.token` with the same `JWT_ACCESS_SECRET` Jorge signs with;
   * the token's `sub` claim is the userId. An absent/invalid token yields no
   * identity → the socket is rejected.
   *
   * Dev valve: ONLY when NODE_ENV !== 'production', fall back to the seeded
   * `handshake.auth.userId` / `x-dev-user` header so QA can impersonate without
   * issuing JWTs. Never active in production.
   */
  private identify(client: Socket): string | null {
    const auth = (client.handshake.auth ?? {}) as {
      userId?: unknown;
      token?: unknown;
    };

    if (typeof auth.token === 'string' && auth.token.trim()) {
      try {
        const payload = this.jwt.verify<{ sub?: string }>(auth.token.trim(), {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
        if (payload?.sub) return payload.sub;
      } catch {
        // Invalid/expired token → fall through (reject, unless dev fallback).
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      if (typeof auth.userId === 'string' && auth.userId.trim()) {
        return auth.userId.trim();
      }
      const header = client.handshake.headers['x-dev-user'];
      const fromHeader = Array.isArray(header) ? header[0] : header;
      if (typeof fromHeader === 'string' && fromHeader.trim()) {
        return fromHeader.trim();
      }
    }

    return null;
  }

  /** Best-effort presence stamp. A bad dev id must not crash the socket. */
  private async touchOnline(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { onlineAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(
        `Could not update onlineAt for ${userId}: ${(err as Error).message}`,
      );
    }
  }
}
