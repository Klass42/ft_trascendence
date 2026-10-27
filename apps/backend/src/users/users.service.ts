import { assertUserLimit, assertCourseLimit, assertStorageLimit } from '@/common/plan-limits/plan-limits';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import type { AuthUser } from '@/common/auth';
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

/** Own profile: public fields + private account data (prefs). Only for /me endpoints. */
const selectOwnProfile = {
  ...selectPublicProfile,
  email: true, organizationId: true,
  emailNotificationsEnabled: true, preferredLanguage: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
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

  async create(dto: CreateUserDto, organizationId: string, actorId?: string) {
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
    if (existing) throw new ConflictException('Email already registered in this organization');
    await assertUserLimit(this.prisma as any, organizationId);
    try {
      const created = await this.prisma.user.create({
        data: {
          organizationId,
          email: dto.email,
          name: dto.name,
          passwordHash: await argon2.hash(dto.password),
          role: dto.role ?? 'STUDENT',
          // La cuenta la crea un admin de la organización y este avala el correo.
          emailVerifiedAt: new Date(),
        },
        select: selectUser,
      });
      await this.notifications?.emitMany(
        [created.id],
        NotificationType.USER_CHANGED,
        { title: 'Tu cuenta ya está lista', body: `Se ha creado tu cuenta en la organización.`, link: '/profile' },
        { organizationId, actorId },
      );
      return created;
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
      const updated = await this.prisma.user.update({ where: { id }, data: dto, select: selectUser });
      if (dto.role !== undefined && dto.role !== user.role) {
        await this.notifications?.emitMany(
          [id],
          NotificationType.USER_CHANGED,
          { title: 'Tu rol ha cambiado', body: `Tu nuevo rol es ${this.roleLabel(dto.role)}.`, link: '/profile' },
          { organizationId, actorId: callerUserId },
        );
      }
      return updated;
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
    await this.notifications?.emitMany(
      async () => {
        const admins = await this.prisma.user.findMany({
          where: { organizationId, role: 'ADMIN' },
          select: { id: true },
        });
        return admins.map(({ id: adminId }) => adminId);
      },
      NotificationType.USER_CHANGED,
      { title: 'Se ha eliminado una cuenta de la organización', link: '/admin/users' },
      { organizationId, actorId: callerUserId },
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: selectOwnProfile });
  }

  async searchUsers(query: string, callerId: string, organizationId: string) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      throw new BadRequestException('Search query must contain at least 2 characters');
    }

    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: callerId }, { addresseeId: callerId }],
        requester: { is: { organizationId } },
        addressee: { is: { organizationId } },
      },
      select: { requesterId: true, addresseeId: true },
    });
    const excludedIds = new Set<string>([callerId]);
    friendships.forEach(({ requesterId, addresseeId }) => {
      excludedIds.add(requesterId);
      excludedIds.add(addresseeId);
    });

    return this.prisma.user.findMany({
      where: {
        organizationId,
        id: { notIn: [...excludedIds] },
        OR: [
          { name: { contains: normalizedQuery, mode: 'insensitive' } },
          { email: { contains: normalizedQuery, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  async sendFriendRequest(callerId: string, targetId: string, callerOrgId: string) {
    if (callerId === targetId) throw new BadRequestException('Cannot friend yourself');
    const caller = await this.prisma.user.findFirst({
      where: { id: callerId, organizationId: callerOrgId },
      select: { id: true },
    });
    if (!caller) throw new NotFoundException('User not found');
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, organizationId: callerOrgId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [{ requesterId: callerId, addresseeId: targetId }, { requesterId: targetId, addresseeId: callerId }],
        requester: { is: { organizationId: callerOrgId } },
        addressee: { is: { organizationId: callerOrgId } },
      },
    });
    if (existing) throw new ConflictException('Friendship already exists');
    const friendship = await this.prisma.friendship.create({ data: { requesterId: callerId, addresseeId: targetId, status: 'PENDING' } });
    // Persist + push over socket via the real contract (David's NotificationsService).
    // No-op if the module isn't wired (optional dep), so friend requests never block.
    await this.notifications?.emitMany(
      [targetId],
      NotificationType.FRIEND_REQUEST,
      { title: 'Tienes una nueva solicitud de amistad', body: 'Puedes revisar las amistades desde tu perfil.', link: '/profile' },
      { organizationId: callerOrgId, actorId: callerId },
    );
    return friendship;
  }

  async listFriends(userId: string, organizationId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        requester: { is: { organizationId } },
        addressee: { is: { organizationId } },
      },
    });
    const friendIds = friendships.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
    if (friendIds.length === 0) return [];
    return this.prisma.user.findMany({
      where: { id: { in: friendIds }, organizationId },
      select: selectPublicProfile,
      orderBy: { name: 'asc' },
    });
  }

  async uploadAvatar(user: AuthUser, file: Express.Multer.File) {
    if (!this.files) throw new BadRequestException('File upload is not available');
    const fileRecord = await this.files.createUpload(
      file,
      user.organizationId,
      user.userId,
      'AVATAR',
    );
    const { url } = await this.files.getSignedUrl(fileRecord.id, user);
    const updated = await this.prisma.user.updateMany({
      where: { id: user.userId, organizationId: user.organizationId },
      data: { avatarUrl: url },
    });
    if (updated.count === 0) throw new NotFoundException('User not found');
    return this.prisma.user.findFirst({
      where: { id: user.userId, organizationId: user.organizationId },
      select: selectPublicProfile,
    });
  }

  async removeAvatar(user: AuthUser) {
    const updated = await this.prisma.user.updateMany({
      where: { id: user.userId, organizationId: user.organizationId },
      data: { avatarUrl: null },
    });
    if (updated.count === 0) throw new NotFoundException('User not found');
    return this.prisma.user.findFirst({
      where: { id: user.userId, organizationId: user.organizationId },
      select: selectPublicProfile,
    });
  }

  // ── Batch fetch for roster (A3) ──

  async findByIds(ids: string[], organizationId: string) {
    if (ids.length === 0) return [];
    return this.prisma.user.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Single lookup for add-student modal (A3) ──

  async lookupByEmail(email: string, organizationId: string, callerRole: string) {
    const user = await this.prisma.user.findFirst({
      where: { organizationId, email },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (callerRole === 'TEACHER' && user.role === 'ADMIN') {
      throw new ForbiddenException('Cannot look up admin users');
    }
    return { userId: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
  }

  private roleLabel(role: string) {
    if (role === 'ADMIN') return 'administrador';
    if (role === 'TEACHER') return 'profesor';
    return 'estudiante';
  }
}
