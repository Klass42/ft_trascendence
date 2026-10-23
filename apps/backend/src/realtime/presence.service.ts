import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

export interface PresenceFriend {
  id: string;
  name: string;
  avatarUrl: string | null;
  online: boolean;
}

/**
 * Read side of presence: the acting user's accepted friends with their current
 * live-socket status. Powers the initial paint of the friends widget; live
 * changes afterwards arrive via the gateway's `presence:update` events. Online
 * state is the gateway's authoritative in-memory count (not the `onlineAt`
 * last-seen stamp, which can't tell "connected now" from "was here recently").
 */
@Injectable()
export class PresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async getFriendsPresence(actingUserId: string, organizationId: string): Promise<PresenceFriend[]> {
    const friendIds = await this.gateway.getAcceptedFriendIds(actingUserId, organizationId);
    if (friendIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: friendIds }, organizationId },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      online: this.gateway.isOnline(u.id),
    }));
  }
}
