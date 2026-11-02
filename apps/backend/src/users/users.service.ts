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
import { NotificationType, Prisma } from '@prisma/client';
import type { AuthUser } from '@/common/auth';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { DeleteAccountDto } from './dto/delete-account.dto';
import type { CreateUserDto } from './dto/create-user.dto';

export type FriendRelation = 'NONE' | 'FRIEND' | 'PENDING_SENT' | 'PENDING_RECEIVED';

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
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (user.organizationId !== organizationId) throw new ForbiddenException('El usuario pertenece a otra organización.');
    if (callerRole !== 'ADMIN') {
      const { id: uid, name, avatarUrl, role, bio, onlineAt } = user;
      return { id: uid, name, avatarUrl, role, bio, onlineAt };
    }
    return user;
  }

  async create(dto: CreateUserDto, organizationId: string, actorId?: string) {
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
    if (existing) throw new ConflictException('Este correo electrónico ya está registrado en la organización.');
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
      await this.prisma.auditLog.create({ data: { actorId: actorId ?? null, action: 'USER_CREATED', organizationId, targetUserId: created.id, metadata: { role: created.role } } });
      return created;
    } catch (err) {
      if (isPrismaUniqueViolation(err)) throw new ConflictException('Este correo electrónico ya está registrado en la organización.');
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto, organizationId: string, callerUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: selectUser });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (user.organizationId !== organizationId) throw new ForbiddenException('El usuario pertenece a otra organización.');
    if (dto.role !== undefined && id === callerUserId) throw new BadRequestException('No puedes cambiar tu propio rol.');
    if (dto.email !== undefined && dto.email !== user.email) {
      const clash = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
      if (clash) throw new ConflictException('Este correo electrónico ya está registrado en la organización.');
    }
    try {
      const updated = await this.prisma.user.update({ where: { id }, data: dto, select: selectUser });
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (dto.role !== undefined && dto.role !== user.role) changes.role = { from: user.role, to: dto.role };
      if (dto.email !== undefined && dto.email !== user.email) changes.email = { from: user.email, to: dto.email };
      if (Object.keys(changes).length) {
        await this.prisma.auditLog.create({ data: { actorId: callerUserId, action: changes.role ? 'USER_ROLE_CHANGED' : 'USER_UPDATED', organizationId, targetUserId: id, metadata: changes as Prisma.InputJsonValue } });
      }
      if (dto.role !== undefined && dto.role !== user.role) {
        await this.notifications?.emitMany(
          [id],
          NotificationType.USER_CHANGED,
          { title: 'Tu rol ha cambiado', body: `Tu nuevo rol es ${this.roleLabel(dto.role)}.`, link: '/profile' },
          { organizationId, actorId: callerUserId },
        );
      }      const profileChanged = (dto.name !== undefined && dto.name !== user.name)
        || (dto.email !== undefined && dto.email !== user.email)
        || (dto.bio !== undefined && dto.bio !== user.bio);
      if (profileChanged) {
        await this.notifications?.emitMany(
          [id],
          NotificationType.USER_CHANGED,
          { title: 'Un administrador ha actualizado tus datos', body: 'Revisa tu perfil para ver los cambios.', link: '/profile' },
          { organizationId, actorId: callerUserId },
        );
      }
      return updated;
    } catch (err) {
      if (isPrismaUniqueViolation(err)) throw new ConflictException('Este correo electrónico ya está registrado en la organización.');
      throw err;
    }
  }

  async remove(id: string, organizationId: string, callerUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { organizationId: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (user.organizationId !== organizationId) throw new ForbiddenException('El usuario pertenece a otra organización.');
    if (id === callerUserId) throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    await this.prisma.user.delete({ where: { id } });
    await this.prisma.auditLog.create({ data: { actorId: callerUserId, action: 'USER_DELETED', organizationId, metadata: { userId: id } } });
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
    const data = dto.name !== undefined ? { ...dto, name: dto.name.trim() } : dto;
    const updated = await this.prisma.user.update({ where: { id: userId }, data, select: selectOwnProfile });
    // Preferences (language, email opt-in) are private; only name/bio edits are news for admins.
    if (updated.organizationId && (dto.name !== undefined || dto.bio !== undefined)) {
      await this.notifyAdmins(
        updated.organizationId,
        userId,
        'Un miembro ha actualizado su perfil',
        `${updated.name} ha modificado sus datos de perfil.`,
        `/admin/users/${userId}`,
      );
    }
    return updated;
  }

  /** Everything we hold about the caller, as promised by the privacy policy (#111). */
  async exportOwnData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, bio: true, avatarUrl: true, role: true,
        organizationId: true, emailVerifiedAt: true, emailNotificationsEnabled: true,
        preferredLanguage: true, createdAt: true, updatedAt: true,
        organization: { select: { id: true, name: true } },
        oauthAccounts: { select: { provider: true, createdAt: true } },
        courseMemberships: true,
        subjectStaff: true,
        submissions: true,
        attempts: true,
        forumThreads: true,
        forumPosts: true,
        notifications: true,
        lessonCompletions: true,
        friendsInitiated: true,
        friendsReceived: true,
        uploadedFiles: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return { exportedAt: new Date().toISOString(), user };
  }

  async deleteOwnAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, organizationId: true, role: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.passwordHash) {
      const valid = dto.password ? await argon2.verify(user.passwordHash, dto.password) : false;
      if (!valid) throw new BadRequestException('La contraseña no es correcta.');
    }
    if (user.role === 'ADMIN' && user.organizationId) {
      const admins = await this.prisma.user.count({
        where: { organizationId: user.organizationId, role: 'ADMIN' },
      });
      if (admins <= 1) {
        throw new BadRequestException(
          'Eres el único administrador de la organización. Nombra a otro administrador antes de eliminar tu cuenta.',
        );
      }
    }
    await this.prisma.user.delete({ where: { id: userId } });
    if (user.organizationId) {
      await this.prisma.auditLog.create({
        data: { actorId: null, action: 'USER_SELF_DELETED', organizationId: user.organizationId, metadata: { userId } },
      });
      await this.notifyAdmins(
        user.organizationId,
        userId,
        'Un miembro ha eliminado su cuenta',
        `${user.name} ha eliminado su cuenta de la organización.`,
        '/admin/users',
      );
    }
  }

  async searchUsers(query: string, callerId: string, organizationId: string) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      throw new BadRequestException('La búsqueda debe tener al menos 2 caracteres.');
    }

    const [friendships, callerMemberships] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          OR: [{ requesterId: callerId }, { addresseeId: callerId }],
          requester: { is: { organizationId } },
          addressee: { is: { organizationId } },
        },
        select: { id: true, requesterId: true, addresseeId: true, status: true },
      }),
      this.prisma.courseMembership.findMany({
        where: { userId: callerId, course: { organizationId } },
        select: { courseId: true },
      }),
    ]);

    // Existing relationships stay in the results so the UI can show their state.
    // BLOCKED pairs are hidden in both directions (never reveal a block).
    const relations = new Map<string, { relation: FriendRelation; friendshipId: string }>();
    const hiddenIds = new Set<string>([callerId]);
    for (const { id, requesterId, addresseeId, status } of friendships) {
      const otherId = requesterId === callerId ? addresseeId : requesterId;
      if (status === 'BLOCKED') hiddenIds.add(otherId);
      else if (status === 'ACCEPTED') relations.set(otherId, { relation: 'FRIEND', friendshipId: id });
      else relations.set(otherId, { relation: requesterId === callerId ? 'PENDING_SENT' : 'PENDING_RECEIVED', friendshipId: id });
    }

    const sharedCourseIds = callerMemberships.map((membership) => membership.courseId);
    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        id: { notIn: [...hiddenIds] },
        OR: [
          { name: { contains: normalizedQuery, mode: 'insensitive' } },
          { email: { contains: normalizedQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        role: true,
        courseMemberships: {
          where: { courseId: { in: sharedCourseIds }, course: { organizationId } },
          select: { course: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
      take: 20,
    });

    return users.map(({ courseMemberships, ...user }) => {
      const known = relations.get(user.id);
      return {
        ...user,
        sharedCourse: courseMemberships[0]?.course.name ?? null,
        relation: known?.relation ?? ('NONE' as FriendRelation),
        friendshipId: known?.friendshipId ?? null,
      };
    });
  }

  async sendFriendRequest(callerId: string, targetId: string, callerOrgId: string) {
    if (callerId === targetId) throw new BadRequestException('No puedes enviarte una solicitud de amistad a ti mismo.');
    const caller = await this.prisma.user.findFirst({
      where: { id: callerId, organizationId: callerOrgId },
      select: { id: true },
    });
    if (!caller) throw new NotFoundException('Usuario no encontrado.');
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, organizationId: callerOrgId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [{ requesterId: callerId, addresseeId: targetId }, { requesterId: targetId, addresseeId: callerId }],
        requester: { is: { organizationId: callerOrgId } },
        addressee: { is: { organizationId: callerOrgId } },
      },
    });
    if (existing) throw new ConflictException('Ya existe una solicitud de amistad con esta persona.');
    const friendship = await this.prisma.friendship.create({ data: { requesterId: callerId, addresseeId: targetId, status: 'PENDING' } });
    // Persist + push over socket via the real contract (David's NotificationsService).
    // No-op if the module isn't wired (optional dep), so friend requests never block.
    await this.notifications?.emitMany(
      [targetId],
      NotificationType.FRIEND_REQUEST,
      { title: 'Tienes una nueva solicitud de amistad', body: 'Puedes revisar tus solicitudes desde Amigos.', link: '/friends' },
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
    if (!this.files) throw new BadRequestException('La subida de archivos no está disponible.');
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
    if (updated.count === 0) throw new NotFoundException('Usuario no encontrado.');
    const profile = await this.prisma.user.findFirst({
      where: { id: user.userId, organizationId: user.organizationId },
      select: selectPublicProfile,
    });
    await this.notifyFriends(user, `${profile?.name ?? 'Una persona'} ha cambiado su foto de perfil`);
    return profile;
  }

  async removeAvatar(user: AuthUser) {
    const updated = await this.prisma.user.updateMany({
      where: { id: user.userId, organizationId: user.organizationId },
      data: { avatarUrl: null },
    });
    if (updated.count === 0) throw new NotFoundException('Usuario no encontrado.');
    const profile = await this.prisma.user.findFirst({
      where: { id: user.userId, organizationId: user.organizationId },
      select: selectPublicProfile,
    });
    await this.notifyFriends(user, `${profile?.name ?? 'Una persona'} ha quitado su foto de perfil`);
    return profile;
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
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (callerRole === 'TEACHER' && user.role === 'ADMIN') {
      throw new ForbiddenException('No se puede consultar a los administradores.');
    }
    return { userId: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
  }

  /** Org admins (never the actor). */
  private async notifyAdmins(organizationId: string, actorId: string, title: string, body: string, link: string) {
    await this.notifications?.emitMany(
      async () => {
        const admins = await this.prisma.user.findMany({
          where: { organizationId, role: 'ADMIN' },
          select: { id: true },
        });
        return admins.map(({ id }) => id);
      },
      NotificationType.USER_CHANGED,
      { title, body, link },
      { organizationId, actorId },
    );
  }

  /** Accepted friends of the actor, resolved inside the actor's organization. */
  private async notifyFriends(user: AuthUser, title: string) {
    await this.notifications?.emitMany(
      async () => {
        const friendships = await this.prisma.friendship.findMany({
          where: {
            status: 'ACCEPTED',
            OR: [{ requesterId: user.userId }, { addresseeId: user.userId }],
            requester: { is: { organizationId: user.organizationId } },
            addressee: { is: { organizationId: user.organizationId } },
          },
          select: { requesterId: true, addresseeId: true },
        });
        return friendships.map((f) => (f.requesterId === user.userId ? f.addresseeId : f.requesterId));
      },
      NotificationType.FRIEND_REQUEST,
      { title, link: '/friends' },
      { organizationId: user.organizationId, actorId: user.userId },
    );
  }

  private roleLabel(role: string) {
    if (role === 'ADMIN') return 'administrador';
    if (role === 'TEACHER') return 'profesor';
    return 'estudiante';
  }
}
