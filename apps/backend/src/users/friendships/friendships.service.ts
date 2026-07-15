import { ForbiddenException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class FriendshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateStatus(friendshipId: string, newStatus: 'ACCEPTED' | 'BLOCKED', callerUserId: string) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) throw new NotFoundException('Friendship not found');
    if (friendship.addresseeId !== callerUserId) throw new ForbiddenException('Only the addressee can accept or block');
    if (friendship.status !== 'PENDING') throw new BadRequestException(`Cannot transition from ${friendship.status} to ${newStatus}`);
    return this.prisma.friendship.update({ where: { id: friendshipId }, data: { status: newStatus } });
  }
}
