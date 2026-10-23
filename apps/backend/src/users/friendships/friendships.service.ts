import { ForbiddenException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/notifications/notifications.service';

@Injectable()
export class FriendshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listMine(userId: string, organizationId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        requester: { is: { organizationId } },
        addressee: { is: { organizationId } },
      },
      select: {
        id: true,
        requesterId: true,
        addresseeId: true,
        status: true,
        requester: { select: { id: true, name: true, avatarUrl: true } },
        addressee: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const friends: Array<{ friendshipId: string; id: string; name: string; avatarUrl: string | null }> = [];
    const receivedRequests: Array<{ friendshipId: string; id: string; name: string; avatarUrl: string | null }> = [];
    const sentRequests: Array<{ friendshipId: string; id: string; name: string; avatarUrl: string | null }> = [];

    for (const friendship of friendships) {
      const isRequester = friendship.requesterId === userId;
      const other = isRequester ? friendship.addressee : friendship.requester;
      const person = { friendshipId: friendship.id, ...other };
      if (friendship.status === 'ACCEPTED') friends.push(person);
      else if (friendship.status === 'PENDING' && isRequester) sentRequests.push(person);
      else if (friendship.status === 'PENDING') receivedRequests.push(person);
    }

    return { friends, receivedRequests, sentRequests };
  }

  async updateStatus(
    friendshipId: string,
    newStatus: 'ACCEPTED' | 'BLOCKED',
    callerUserId: string,
    organizationId: string,
  ) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        id: friendshipId,
        requester: { is: { organizationId } },
        addressee: { is: { organizationId } },
      },
    });
    if (!friendship) throw new NotFoundException('Friendship not found');
    if (friendship.addresseeId !== callerUserId) throw new ForbiddenException('Only the addressee can accept or block');
    if (friendship.status !== 'PENDING') throw new BadRequestException(`Cannot transition from ${friendship.status} to ${newStatus}`);
    const scope = {
      id: friendshipId,
      requester: { is: { organizationId } },
      addressee: { is: { organizationId } },
    };
    const result = await this.prisma.friendship.updateMany({
      where: { ...scope, status: 'PENDING' },
      data: { status: newStatus },
    });
    if (result.count === 0) throw new NotFoundException('Friendship not found');
    const updated = await this.prisma.friendship.findFirst({ where: scope });
    if (newStatus === 'ACCEPTED') {
      await this.notifications.emit(friendship.requesterId, 'FRIEND_REQUEST', {
        title: 'Solicitud de amistad aceptada',
        body: 'Tu solicitud de amistad ha sido aceptada.',
        link: '/friends',
      });
    }
    return updated;
  }

  async remove(friendshipId: string, callerUserId: string, organizationId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        id: friendshipId,
        requester: { is: { organizationId } },
        addressee: { is: { organizationId } },
      },
    });
    if (!friendship) throw new NotFoundException('Friendship not found');
    if (friendship.requesterId !== callerUserId && friendship.addresseeId !== callerUserId) {
      throw new ForbiddenException('Only friendship participants can remove it');
    }
    const result = await this.prisma.friendship.deleteMany({
      where: {
        id: friendshipId,
        requester: { is: { organizationId } },
        addressee: { is: { organizationId } },
      },
    });
    if (result.count === 0) throw new NotFoundException('Friendship not found');
    return { deleted: true };
  }
}
