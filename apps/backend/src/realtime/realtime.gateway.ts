import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Notification } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

// Same origin the HTTP layer allows (see main.ts). In dev the frontend also
// proxies /socket.io through Vite, so most connections arrive same-origin; this
// keeps direct ws://localhost:3000 clients working too.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/** The Socket.io room a given user's live connections all join. */
function userRoom(userId: string): string {
  return `user:${userId}`;
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
 * - Presence: stamps `User.onlineAt` on connect/disconnect (last-seen).
 */
@WebSocketGateway({
  cors: { origin: FRONTEND_URL, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket): Promise<void> {
    const userId = this.identify(client);
    if (!userId) {
      // No valid identity → refuse the socket rather than leave it anonymous.
      this.logger.warn(`Socket ${client.id} rejected: missing user identity`);
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    await client.join(userRoom(userId));
    await this.touchOnline(userId);
    this.logger.log(`Socket ${client.id} connected as ${userId}`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    await this.touchOnline(userId);
    this.logger.log(`Socket ${client.id} (${userId}) disconnected`);
    // TODO(presence): emitir online/offline A AMIGOS (necesita Friendship de
    // Jorge). Por ahora solo actualizamos onlineAt (last-seen).
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

  /**
   * DEV identity: the acting user comes from the Socket.io handshake —
   * `handshake.auth.userId` (preferred) or the `x-dev-user` header fallback.
   * TODO(auth): verificar JWT real (Jorge) en handshake.auth.token.
   */
  private identify(client: Socket): string | null {
    const auth = (client.handshake.auth ?? {}) as {
      userId?: unknown;
      token?: unknown;
    };
    if (typeof auth.userId === 'string' && auth.userId.trim()) {
      return auth.userId.trim();
    }

    const header = client.handshake.headers['x-dev-user'];
    const fromHeader = Array.isArray(header) ? header[0] : header;
    return typeof fromHeader === 'string' && fromHeader.trim()
      ? fromHeader.trim()
      : null;
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
