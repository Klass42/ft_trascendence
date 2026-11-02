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
    if (!friendship) throw new NotFoundException('Solicitud de amistad no encontrada.');
    if (friendship.addresseeId !== callerUserId) throw new ForbiddenException('Solo quien recibe la solicitud puede aceptarla o bloquearla.');
    if (friendship.status !== 'PENDING') throw new BadRequestException('Esta solicitud de amistad ya no se puede modificar.');
    const scope = {
      id: friendshipId,
      requester: { is: { organizationId } },
      addressee: { is: { organizationId } },
    };
    const result = await this.prisma.friendship.updateMany({
      where: { ...scope, status: 'PENDING' },
      data: { status: newStatus },
    });
    if (result.count === 0) throw new NotFoundException('Solicitud de amistad no encontrada.');
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
    if (!friendship) throw new NotFoundException('Solicitud de amistad no encontrada.');
    if (friendship.requesterId !== callerUserId && friendship.addresseeId !== callerUserId) {
      throw new ForbiddenException('Solo las personas implicadas pueden eliminar esta amistad.');
    }
    const result = await this.prisma.friendship.deleteMany({
      where: {
        id: friendshipId,
        requester: { is: { organizationId } },
        addressee: { is: { organizationId } },
      },
    });
    if (result.count === 0) throw new NotFoundException('Solicitud de amistad no encontrada.');

    // BLOCKED rows are never announced: a block must stay invisible to the other person.
    if (friendship.status !== 'BLOCKED') {
      const callerIsRequester = friendship.requesterId === callerUserId;
      const [otherId, title, body] = friendship.status === 'ACCEPTED'
        ? [callerIsRequester ? friendship.addresseeId : friendship.requesterId, 'Una amistad ha terminado', 'Ya no sois amigos en Klass.']
        : callerIsRequester
          ? [friendship.addresseeId, 'Solicitud de amistad cancelada', 'La persona que te la envió la ha retirado.']
          : [friendship.requesterId, 'Solicitud de amistad rechazada', 'Tu solicitud de amistad no ha sido aceptada.'];
      await this.notifications.emitMany(
        [otherId],
        'FRIEND_REQUEST',
        { title, body, link: '/friends' },
        { organizationId, actorId: callerUserId },
      );
    }
    return { deleted: true };
  }
}
