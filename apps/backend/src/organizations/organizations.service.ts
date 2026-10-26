import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/notifications/notifications.service';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import * as crypto from 'crypto';
import type { ListMembersQueryDto } from './dto/list-members-query.dto';

export interface Member {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  bio: string | null;
  onlineAt: Date | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type MemberStatus = 'active' | 'inactive' | 'pending';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async invite(organizationId: string, invitedById: string, dto: CreateInvitationDto) {
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
    if (existing) throw new BadRequestException('Email already belongs to this organization');
    const raw = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const invitation = await this.prisma.organizationInvitation.upsert({
      where: { organizationId_email: { organizationId, email: dto.email } },
      create: { organizationId, email: dto.email, role: dto.role, tokenHash, expiresAt, invitedById },
      update: { role: dto.role, tokenHash, expiresAt, status: 'PENDING', acceptedAt: null, invitedById },
    });
    await this.prisma.auditLog.create({ data: { actorId: invitedById, action: 'MEMBER_INVITED', organizationId, metadata: { invitationId: invitation.id, role: dto.role } } });
    return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt, invitationToken: raw };
  }

  async revokeInvitation(organizationId: string, invitationId: string, actorId: string) {
    const changed = await this.prisma.organizationInvitation.updateMany({ where: { id: invitationId, organizationId, status: 'PENDING' }, data: { status: 'REVOKED' } });
    if (!changed.count) throw new NotFoundException('Pending invitation not found');
    await this.prisma.auditLog.create({ data: { actorId, action: 'INVITATION_REVOKED', organizationId, metadata: { invitationId } } });
    return { revoked: true };
  }

  async findMyOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, callerOrgId: string, callerUserId?: string) {
    if (id !== callerOrgId) {
      throw new ForbiddenException('Cannot edit an organization you do not belong to');
    }
    const updated = await this.prisma.organization.update({ where: { id }, data: dto });
    await this.notifications.emitMany(
      async () => {
        const members = await this.prisma.user.findMany({
          where: { organizationId: id },
          select: { id: true },
        });
        return members.map(({ id: memberId }) => memberId);
      },
      NotificationType.ORGANIZATION_CHANGED,
      { title: 'La organización se ha actualizado', body: `Se han actualizado los datos de «${updated.name}».`, link: '/profile' },
      { organizationId: id, actorId: callerUserId },
    );
    return updated;
  }

  async findMembers(
    id: string,
    callerOrgId: string,
    query?: ListMembersQueryDto,
  ): Promise<Member[] | { data: Array<Member & { status: MemberStatus }>; total: number; page: number; pageSize: number; totalPages: number }> {
    if (id !== callerOrgId) {
      throw new ForbiddenException('Cannot list members of another organization');
    }

    const select = {
      id: true, email: true, name: true, avatarUrl: true, role: true,
      bio: true, onlineAt: true, emailVerifiedAt: true,
      createdAt: true, updatedAt: true,
    } as const;
    const hasQuery = !!query && Object.values(query).some((value) => value !== undefined);
    if (!hasQuery) {
      return this.prisma.user.findMany({
        where: { organizationId: id },
        select,
        orderBy: { name: 'asc' },
      });
    }

    const filters: Prisma.UserWhereInput[] = [];
    const search = query?.q?.trim();
    if (search) {
      filters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // onlineAt is the persisted last-seen stamp from the realtime gateway.
    const presenceSince = new Date(Date.now() - 5 * 60 * 1000);
    if (query?.status === 'pending') {
      filters.push({ emailVerifiedAt: null });
    } else if (query?.status === 'active') {
      filters.push({ emailVerifiedAt: { not: null }, onlineAt: { gte: presenceSince } });
    } else if (query?.status === 'inactive') {
      filters.push({
        emailVerifiedAt: { not: null },
        OR: [{ onlineAt: null }, { onlineAt: { lt: presenceSince } }],
      });
    }

    const where: Prisma.UserWhereInput = {
      organizationId: id,
      ...(query?.role && { role: query.role }),
      ...(filters.length > 0 && { AND: filters }),
    };
    const page = query?.page ?? 1;
    const pageSize = Math.min(query?.pageSize ?? 25, 100);
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const members = data.map((member) => ({
      ...member,
      status: !member.emailVerifiedAt
        ? 'pending' as const
        : member.onlineAt && member.onlineAt >= presenceSince
          ? 'active' as const
          : 'inactive' as const,
    }));

    return { data: members, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getDeletionRequestStatus(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const pending = await this.prisma.notification.findFirst({
      where: {
        title: `Solicitud de borrado: ${org.name}`,
        link: `/platform/organizations/${org.id}`,
        read: false,
        user: { platformRole: 'SUPERADMIN' },
      },
      select: { id: true },
    });
    return { pending: Boolean(pending) };
  }

  async removeMember(
    id: string, userId: string, callerOrgId: string, callerUserId: string,
  ): Promise<void> {
    if (id !== callerOrgId) {
      throw new ForbiddenException('Cannot remove members from another organization');
    }
    if (userId === callerUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, organizationId: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.organizationId !== id) throw new ForbiddenException('User belongs to another organization');
    await this.prisma.user.delete({ where: { id: userId } });
    await this.notifications.emitMany(
      async () => {
        const admins = await this.prisma.user.findMany({
          where: { organizationId: id, role: 'ADMIN' },
          select: { id: true },
        });
        return admins.map(({ id: adminId }) => adminId);
      },
      NotificationType.USER_CHANGED,
      { title: 'Se ha eliminado un miembro', body: `Se ha dado de baja a ${target.name}.`, link: '/admin/users' },
      { organizationId: id, actorId: callerUserId },
    );
  }

  /**
   * An org admin cannot delete the organization. This tells every platform
   * SUPERADMIN, once per unread request, so they can do it from the platform UI.
   */
  async requestDeletion(
    organizationId: string,
    actor: { userId: string; name: string; email: string },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const superadmins = await this.prisma.user.findMany({
      where: { platformRole: 'SUPERADMIN' },
      select: { id: true },
    });
    if (superadmins.length === 0) {
      throw new ServiceUnavailableException('No platform superadmin can receive this request');
    }

    const title = `Solicitud de borrado: ${org.name}`;
    const link = `/platform/organizations/${org.id}`;
    let notified = 0;

    for (const superadmin of superadmins) {
      const pending = await this.prisma.notification.findFirst({
        where: { userId: superadmin.id, link, title, read: false },
        select: { id: true },
      });
      if (pending) continue;

      await this.notifications.emit(superadmin.id, NotificationType.SYSTEM, {
        title,
        body: `${actor.name} (${actor.email}) pide borrar la organización «${org.name}» (${org.slug}).`,
        link,
      });
      notified += 1;
    }

    if (notified > 0) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'ORGANIZATION_DELETION_REQUESTED',
          organizationId: org.id,
          metadata: { notified },
        },
      });
    }

    return { notified, alreadyPending: notified === 0 };
  }
  /**
   * Org admin withdraws a pending deletion request: mark the unread
   * SUPERADMIN notifications as read so getDeletionRequestStatus clears.
   */
  async cancelDeletionRequest(
    organizationId: string,
    actor: { userId: string },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const title = `Solicitud de borrado: ${org.name}`;
    const link = `/platform/organizations/${org.id}`;

    const pending = await this.prisma.notification.findMany({
      where: {
        title,
        link,
        read: false,
        user: { platformRole: 'SUPERADMIN' },
      },
      select: { id: true },
    });

    if (pending.length === 0) {
      return { cancelled: 0, wasPending: false };
    }

    await this.prisma.notification.updateMany({
      where: { id: { in: pending.map((n) => n.id) } },
      data: { read: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action: 'ORGANIZATION_DELETION_REQUEST_CANCELLED',
        organizationId: org.id,
        metadata: { cancelled: pending.length },
      },
    });

    return { cancelled: pending.length, wasPending: true };
  }

}
