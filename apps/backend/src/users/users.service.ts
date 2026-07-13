import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import { FilesService } from '../files/files.service';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { CreateUserDto } from './dto/create-user.dto';

function isPrismaUniqueViolation(err: unknown): err is PrismaClientKnownRequestError {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
}

const selectUser = {
  id: true, email: true, name: true, avatarUrl: true,
  role: true, bio: true, onlineAt: true, emailVerifiedAt: true,
  organizationId: true, createdAt: true, updatedAt: true,
} as const;

const selectPublicProfile = {
  id: true, name: true, avatarUrl: true, role: true, bio: true, onlineAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly files?: FilesService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: selectUser,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, organizationId: string, callerRole?: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: selectUser });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    if (callerRole !== 'ADMIN') {
      const { id: uid, name, avatarUrl, role, bio, onlineAt } = user;
      return { id: uid, name, avatarUrl, role, bio, onlineAt };
    }
    return user;
  }

  async create(dto: CreateUserDto, organizationId: string) {
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
    if (existing) throw new ConflictException('Email already registered in this organization');
    const isDev = process.env.NODE_ENV !== 'production';
    try {
      return await this.prisma.user.create({
        data: {
          organizationId,
          email: dto.email,
          name: dto.name,
          passwordHash: await argon2.hash(dto.password),
          role: dto.role ?? 'STUDENT',
          emailVerifiedAt: isDev ? new Date() : null,
        },
        select: selectUser,
      });
    } catch (err) {
      if (isPrismaUniqueViolation(err)) throw new ConflictException('Email already registered in this organization');
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto, organizationId: string, callerUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: selectUser });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    if (dto.role !== undefined && id === callerUserId) throw new BadRequestException('Cannot change your own role');
    if (dto.email !== undefined && dto.email !== user.email) {
      const clash = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
      if (clash) throw new ConflictException('Email already registered in this organization');
    }
    try {
      return await this.prisma.user.update({ where: { id }, data: dto, select: selectUser });
    } catch (err) {
      if (isPrismaUniqueViolation(err)) throw new ConflictException('Email already registered in this organization');
      throw err;
    }
  }

  async remove(id: string, organizationId: string, callerUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { organizationId: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    if (id === callerUserId) throw new BadRequestException('Cannot delete yourself');
    await this.prisma.user.delete({ where: { id } });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: selectPublicProfile });
  }

  async sendFriendRequest(callerId: string, targetId: string, callerOrgId: string) {
    if (callerId === targetId) throw new BadRequestException('Cannot friend yourself');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { organizationId: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.organizationId !== callerOrgId) throw new ForbiddenException('User belongs to another organization');
    const existing = await this.prisma.friendship.findFirst({
      where: { OR: [{ requesterId: callerId, addresseeId: targetId }, { requesterId: targetId, addresseeId: callerId }] },
    });
    if (existing) throw new ConflictException('Friendship already exists');
    const friendship = await this.prisma.friendship.create({ data: { requesterId: callerId, addresseeId: targetId, status: 'PENDING' } });
    this.eventEmitter.emit('notification.created', { userId: targetId, type: 'FRIEND_REQUEST', title: 'New friend request', body: 'You have a new friend request', link: null, read: false, createdAt: new Date() });
    return friendship;
  }

  async listFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    });
    const friendIds = friendships.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
    return this.prisma.user.findMany({ where: { id: { in: friendIds } }, select: selectPublicProfile, orderBy: { name: 'asc' } });
  }

  async uploadAvatar(userId: string, organizationId: string, file: Express.Multer.File) {
    if (!this.files) throw new BadRequestException('File upload is not available');
    const fileRecord = await this.files.createUpload(file, organizationId, userId);
    const { url } = await this.files.getSignedUrl(fileRecord.id);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
    return this.prisma.user.findUnique({ where: { id: userId }, select: selectPublicProfile });
  }
}
