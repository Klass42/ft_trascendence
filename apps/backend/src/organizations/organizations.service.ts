import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { assertUserLimit } from '@/common/plan-limits/plan-limits';
import { NotificationType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { USER_DEACTIVATED, type UserDeactivatedEvent } from '@/realtime/realtime.events';
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
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_IMPORT_ROWS = 500;
// Same rule as the DTOs (IsEmail with require_tld: false): local@domain, no TLD required.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)*$/;

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Minimal RFC 4180 parser: quotes, escaped quotes, CRLF/LF, BOM. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

type MemberStatus = 'active' | 'inactive' | 'pending';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  async invite(organizationId: string, invitedById: string, dto: CreateInvitationDto, auditAction = 'MEMBER_INVITED') {
    const email = dto.email.trim().toLowerCase();
    dto = { ...dto, email };
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: { equals: email, mode: 'insensitive' } } });
    if (existing) throw new BadRequestException('Ya existe una persona con ese correo electrónico en esta organización.');
    const previous = await this.prisma.organizationInvitation.findUnique({ where: { organizationId_email: { organizationId, email } } });
    const replacedPending = !!previous && previous.status === 'PENDING' && previous.expiresAt > new Date();
    const raw = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const invitation = await this.prisma.organizationInvitation.upsert({
      where: { organizationId_email: { organizationId, email: dto.email } },
      create: { organizationId, email: dto.email, role: dto.role, tokenHash, expiresAt, invitedById },
      update: { role: dto.role, tokenHash, expiresAt, status: 'PENDING', acceptedAt: null, invitedById },
    });
    await this.prisma.auditLog.create({ data: { actorId: invitedById, action: auditAction, organizationId, metadata: { invitationId: invitation.id, email, role: dto.role, replacedPending } } });
    // CSV rows are summarised once by importInvitations instead of one notice per row.
    if (auditAction !== 'MEMBER_INVITED_CSV') {
      await this.notifyAdmins(
        organizationId,
        invitedById,
        auditAction === 'INVITATION_RESENT' ? 'Invitación reenviada' : 'Nueva invitación enviada',
        `${email} (${dto.role}) tiene una invitación pendiente.`,
        '/admin/users/invitations',
      );
    }
    return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt, invitationToken: raw, replacedPending };
  }

  /** Pending invitations (including expired-but-unaccepted ones, flagged). */
  async listInvitations(organizationId: string) {
    const rows = await this.prisma.organizationInvitation.findMany({
      where: { organizationId, status: 'PENDING' },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, updatedAt: true, invitedBy: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const now = new Date();
    return rows.map((row) => ({ ...row, expired: row.expiresAt <= now }));
  }

  /** Issues a fresh link for a pending invitation; the previous link stops working. */
  async resendInvitation(organizationId: string, invitationId: string, actorId: string) {
    const invitation = await this.prisma.organizationInvitation.findFirst({ where: { id: invitationId, organizationId, status: 'PENDING' } });
    if (!invitation) throw new NotFoundException('No existe una invitación pendiente con ese id.');
    const result = await this.invite(organizationId, actorId, { email: invitation.email, role: invitation.role }, 'INVITATION_RESENT');
    return { ...result, replacedPending: true };
  }

  /**
   * Bulk invitations from CSV (header: email,name,role). Each valid row gets an
   * invitation link; invalid rows are reported with their line number. `name` is
   * informative only: the invitee chooses their name when accepting.
   */
  async importInvitations(organizationId: string, actorId: string, csv: string) {
    const rows = parseCsv(csv);
    if (rows.length === 0) throw new BadRequestException('El CSV está vacío.');
    const header = rows[0].map((cell) => cell.trim().toLowerCase());
    const emailIdx = header.indexOf('email');
    const nameIdx = header.indexOf('name');
    const roleIdx = header.indexOf('role');
    if (emailIdx < 0 || roleIdx < 0) throw new BadRequestException('La cabecera debe incluir las columnas email y role (name es opcional).');
    const dataRows = rows.slice(1);
    if (dataRows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`El CSV no puede tener más de ${MAX_IMPORT_ROWS} filas.`);
    const seen = new Set<string>();
    const results: Array<{ line: number; email: string; name?: string; ok: boolean; error?: string; role?: string; invitationToken?: string; replacedPending?: boolean }> = [];
    for (let i = 0; i < dataRows.length; i++) {
      const line = i + 2;
      const cells = dataRows[i];
      if (cells.every((cell) => !cell.trim())) continue;
      const email = (cells[emailIdx] ?? '').trim().toLowerCase();
      const name = nameIdx >= 0 ? (cells[nameIdx] ?? '').trim() : undefined;
      const role = (cells[roleIdx] ?? '').trim().toUpperCase();
      const fail = (error: string) => results.push({ line, email, name, ok: false, error });
      if (!email || email.length > 254 || !EMAIL_RE.test(email)) { fail('Email no válido.'); continue; }
      if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) { fail('Rol no válido (usa STUDENT, TEACHER o ADMIN).'); continue; }
      if (name && name.length > 100) { fail('El nombre no puede superar los 100 caracteres.'); continue; }
      if (seen.has(email)) { fail('Email duplicado en el CSV.'); continue; }
      seen.add(email);
      try {
        const created = await this.invite(organizationId, actorId, { email, role: role as 'STUDENT' | 'TEACHER' | 'ADMIN' }, 'MEMBER_INVITED_CSV');
        results.push({ line, email, name, ok: true, role, invitationToken: created.invitationToken, replacedPending: created.replacedPending });
      } catch (error) {
        fail(error instanceof BadRequestException ? error.message : 'No se pudo crear la invitación.');
      }
    }
    const created = results.filter((r) => r.ok).length;
    await this.prisma.auditLog.create({ data: { actorId, action: 'INVITATIONS_IMPORTED', organizationId, metadata: { rows: results.length, created, failed: results.length - created } } });
    if (created > 0) {
      await this.notifyAdmins(
        organizationId,
        actorId,
        'Invitaciones importadas',
        `Se ${created === 1 ? 'ha creado 1 invitación' : `han creado ${created} invitaciones`} desde un CSV.`,
        '/admin/users/invitations',
      );
    }
    return { total: results.length, created, failed: results.length - created, results };
  }

  async listAuditLogs(organizationId: string, page = 1, pageSize = 50) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip, take,
        select: { id: true, action: true, targetUserId: true, metadata: true, createdAt: true, actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { organizationId } }),
    ]);
    return { data, total, page: Math.max(page, 1), pageSize: take, totalPages: Math.ceil(total / take) };
  }

  async stats(organizationId: string) {
    const now = new Date();
    const [byRole, pendingInvitations, courses, activeCourses, subjects] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], where: { organizationId }, _count: { _all: true } }),
      this.prisma.organizationInvitation.count({ where: { organizationId, status: 'PENDING', expiresAt: { gt: now } } }),
      this.prisma.course.count({ where: { organizationId } }),
      this.prisma.course.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.subject.count({ where: { organizationId } }),
    ]);
    const roles = { ADMIN: 0, TEACHER: 0, STUDENT: 0 } as Record<string, number>;
    for (const row of byRole) roles[row.role] = row._count._all;
    return { users: roles.ADMIN + roles.TEACHER + roles.STUDENT, roles, pendingInvitations, courses, activeCourses, subjects };
  }

  async revokeInvitation(organizationId: string, invitationId: string, actorId: string) {
    const changed = await this.prisma.organizationInvitation.updateMany({ where: { id: invitationId, organizationId, status: 'PENDING' }, data: { status: 'REVOKED' } });
    if (!changed.count) throw new NotFoundException('Invitación pendiente no encontrada.');
    await this.prisma.auditLog.create({ data: { actorId, action: 'INVITATION_REVOKED', organizationId, metadata: { invitationId } } });
    await this.notifyAdmins(organizationId, actorId, 'Invitación revocada', 'Se ha revocado una invitación pendiente.', '/admin/users/invitations');
    return { revoked: true };
  }

  async findMyOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException('Organización no encontrada.');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, callerOrgId: string, callerUserId?: string) {
    if (id !== callerOrgId) {
      throw new ForbiddenException('No puedes editar una organización a la que no perteneces.');
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
      { title: 'La organización se ha actualizado', body: `Se han actualizado los datos de «${updated.name}».`, link: '/org' },
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
      throw new ForbiddenException('No puedes ver los miembros de otra organización.');
    }

    const select = {
      id: true, email: true, name: true, avatarUrl: true, role: true,
      bio: true, onlineAt: true, emailVerifiedAt: true, deactivatedAt: true,
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
      // Prisma passes `contains` straight into LIKE: escape %, _ and \ so they match literally.
      const literal = escapeLike(search);
      filters.push({
        OR: [
          { name: { contains: literal, mode: 'insensitive' } },
          { email: { contains: literal, mode: 'insensitive' } },
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

    // #134: account state (removed from the org = deactivated), independent of presence `status`.
    if (query?.account === 'active') filters.push({ deactivatedAt: null });
    else if (query?.account === 'deactivated') filters.push({ deactivatedAt: { not: null } });

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
    if (!org) throw new NotFoundException('Organización no encontrada.');

    const pending = await this.prisma.notification.findFirst({
      where: {
        title: `Solicitud de eliminación: ${org.name}`,
        link: `/platform/organizations/${org.id}`,
        read: false,
        user: { platformRole: 'SUPERADMIN' },
      },
      select: { id: true },
    });
    return { pending: Boolean(pending) };
  }

  /**
   * #134: "remove from the organization" = DEACTIVATE, not delete. The account
   * keeps its submissions, grades, attempts, forum posts, course enrolments and
   * subject staff seats (so grades stay in the gradebook and reactivation
   * restores everything); it only loses its sessions and cannot sign in until
   * an admin reactivates it. Hard delete stays on DELETE /users/:id.
   */
  async removeMember(
    id: string, userId: string, callerOrgId: string, callerUserId: string,
  ): Promise<void> {
    if (id !== callerOrgId) {
      throw new ForbiddenException('No puedes quitar miembros de otra organización.');
    }
    if (userId === callerUserId) {
      throw new BadRequestException('No puedes quitarte a ti mismo de la organización.');
    }
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, organizationId: true, deactivatedAt: true } });
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (target.organizationId !== id) throw new ForbiddenException('El usuario pertenece a otra organización.');
    if (target.deactivatedAt) throw new BadRequestException('Esta persona ya está desactivada.');
    const deactivatedAt = new Date();
    const removed = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { deactivatedAt } });
      const sessions = await tx.session.deleteMany({ where: { userId } });
      await tx.auditLog.create({ data: { actorId: callerUserId, action: 'MEMBER_DEACTIVATED', organizationId: id, targetUserId: userId, metadata: { userId, name: target.name, sessions: sessions.count } } });
      return true;
    });
    // #135 (PR #142): the realtime gateway disconnects user:<id> on this event.
    if (removed) this.events?.emit(USER_DEACTIVATED, { userId } satisfies UserDeactivatedEvent);
    await this.notifications.emitMany(
      async () => {
        const admins = await this.prisma.user.findMany({
          where: { organizationId: id, role: 'ADMIN', deactivatedAt: null },
          select: { id: true },
        });
        return admins.map(({ id: adminId }) => adminId);
      },
      NotificationType.USER_CHANGED,
      { title: 'Se ha quitado a un miembro', body: `Se ha desactivado la cuenta de ${target.name}. Se puede reactivar desde Usuarios.`, link: '/admin/users' },
      { organizationId: id, actorId: callerUserId },
    );
  }

  /** #134: undo removeMember. Enrolments and staff seats were kept, so access is fully restored. */
  async reactivateMember(
    id: string, userId: string, callerOrgId: string, callerUserId: string,
  ) {
    if (id !== callerOrgId) {
      throw new ForbiddenException('No puedes reactivar miembros de otra organización.');
    }
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, organizationId: true, deactivatedAt: true } });
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (target.organizationId !== id) throw new ForbiddenException('El usuario pertenece a otra organización.');
    if (!target.deactivatedAt) throw new BadRequestException('Esta persona ya está activa.');
    await assertUserLimit(this.prisma as any, id);
    await this.prisma.user.update({ where: { id: userId }, data: { deactivatedAt: null } });
    await this.prisma.auditLog.create({ data: { actorId: callerUserId, action: 'MEMBER_REACTIVATED', organizationId: id, targetUserId: userId, metadata: { userId, name: target.name } } });
    // Sent after clearing deactivatedAt, otherwise emitMany would drop the recipient.
    await this.notifications.emitMany(
      [userId],
      NotificationType.USER_CHANGED,
      { title: 'Tu cuenta se ha reactivado', body: 'Ya puedes volver a iniciar sesión y acceder a tus cursos.', link: '/dashboard' },
      { organizationId: id, actorId: callerUserId },
    );
    await this.notifications.emitMany(
      async () => {
        const admins = await this.prisma.user.findMany({
          where: { organizationId: id, role: 'ADMIN', deactivatedAt: null },
          select: { id: true },
        });
        return admins.map(({ id: adminId }) => adminId);
      },
      NotificationType.USER_CHANGED,
      { title: 'Se ha reactivado a un miembro', body: `Se ha reactivado la cuenta de ${target.name}.`, link: '/admin/users' },
      { organizationId: id, actorId: callerUserId },
    );
    return { id: userId, deactivatedAt: null };
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
    if (!org) throw new NotFoundException('Organización no encontrada.');

    const superadmins = await this.prisma.user.findMany({
      where: { platformRole: 'SUPERADMIN' },
      select: { id: true },
    });
    if (superadmins.length === 0) {
      throw new ServiceUnavailableException('Ninguna persona administradora de la plataforma puede recibir esta solicitud.');
    }

    const title = `Solicitud de eliminación: ${org.name}`;
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
        body: `${actor.name} (${actor.email}) pide eliminar la organización «${org.name}» (${org.slug}).`,
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
      await this.notifyAdmins(
        organizationId,
        actor.userId,
        'Solicitud de eliminación enviada',
        `${actor.name} ha pedido eliminar «${org.name}». La plataforma la revisará.`,
        '/org',
      );
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
    if (!org) throw new NotFoundException('Organización no encontrada.');

    const title = `Solicitud de eliminación: ${org.name}`;
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
    await this.notifyAdmins(
      organizationId,
      actor.userId,
      'Solicitud de eliminación cancelada',
      `Se ha retirado la solicitud para eliminar «${org.name}».`,
      '/org',
    );

    return { cancelled: pending.length, wasPending: true };
  }

  /** Tell the organization's admins (never the actor). */
  private async notifyAdmins(organizationId: string, actorId: string, title: string, body: string, link: string) {
    await this.notifications.emitMany(
      async () => {
        const admins = await this.prisma.user.findMany({
          where: { organizationId, role: 'ADMIN' },
          select: { id: true },
        });
        return admins.map(({ id }) => id);
      },
      NotificationType.ORGANIZATION_CHANGED,
      { title, body, link },
      { organizationId, actorId },
    );
  }
}
