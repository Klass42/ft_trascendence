import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { CreatePlatformOrganizationDto } from './dto/create-platform-organization.dto';
import type { UpdatePlatformOrganizationDto } from './dto/update-platform-organization.dto';
import type { CreatePlatformOrganizationAdminDto } from './dto/create-platform-organization-admin.dto';

@Injectable()
export class PlatformService {
 constructor(private readonly prisma: PrismaService) {}
 private token() { const raw = crypto.randomBytes(32).toString('base64url'); return { raw, hash: crypto.createHash('sha256').update(raw).digest('hex') }; }
 async createOrganization(dto: CreatePlatformOrganizationDto, actorId: string) {
  const token = this.token(); const expiresAt = new Date(Date.now() + 7 * 86400000);
  try { const result = await this.prisma.$transaction(async tx => {
   const organization = await tx.organization.create({ data: { name: dto.name, slug: dto.slug, logoUrl: dto.logoUrl, primaryColor: dto.primaryColor, defaultLanguage: dto.defaultLanguage, timezone: dto.timezone, plan: dto.plan, maxUsers: dto.maxUsers, maxCourses: dto.maxCourses, maxStorageMb: dto.maxStorageMb } });
   const invitation = await tx.organizationInvitation.create({ data: { organizationId: organization.id, email: dto.adminEmail, role: 'ADMIN', tokenHash: token.hash, expiresAt, invitedById: actorId } });
   await tx.auditLog.create({ data: { actorId, action: 'ORGANIZATION_PROVISIONED', organizationId: organization.id, metadata: { firstAdminEmail: dto.adminEmail, invitationId: invitation.id } } });
   return { organization, invitationId: invitation.id };
  }); return { ...result, invitationToken: token.raw }; } catch (error: any) { if (error?.code === 'P2002') throw new ConflictException('Organization slug already exists'); throw error; }
 }
 async listOrganizations() { return this.prisma.organization.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { users: true, invitations: { where: { status: 'PENDING' } } } } } }); }
 async getOrganization(id: string) { const org = await this.prisma.organization.findUnique({ where: { id }, include: { _count: { select: { users: true, invitations: true } } } }); if (!org) throw new NotFoundException('Organization not found'); return org; }
 async updateOrganization(id: string, dto: UpdatePlatformOrganizationDto, actorId: string) { const org = await this.prisma.organization.update({ where: { id }, data: dto, include: { _count: { select: { users: true, invitations: true } } } }); await this.prisma.auditLog.create({ data: { actorId, action: 'ORGANIZATION_UPDATED', organizationId: id, metadata: dto as Prisma.InputJsonValue } }); return org; }
 async suspend(id: string, actorId: string) { const org = await this.prisma.$transaction(async tx => { const updated = await tx.organization.update({ where: { id }, data: { status: 'SUSPENDED' }, include: { _count: { select: { users: true, invitations: true } } } }); const users = await tx.user.findMany({ where: { organizationId: id }, select: { id: true } }); await tx.session.deleteMany({ where: { userId: { in: users.map(u => u.id) } } }); await tx.auditLog.create({ data: { actorId, action: 'ORGANIZATION_SUSPENDED', organizationId: id } }); return updated; }); return org; }
 async deleteOrganization(id: string, actorId: string) {
  const org = await this.prisma.organization.findUnique({ where: { id } });
  if (!org) throw new NotFoundException('Organization not found');
  await this.prisma.$transaction(async tx => {
   await tx.auditLog.create({ data: { actorId, action: 'ORGANIZATION_DELETED', organizationId: id, metadata: { name: org.name, slug: org.slug } } });
   // LearningResource.createdBy and .file are ON DELETE RESTRICT. Remove the
   // catalog rows before the organization cascade deletes users and files.
   await tx.learningResource.deleteMany({ where: { organizationId: id } });
   await tx.organization.delete({ where: { id } });
  });
 }

 // Support/recovery flow (issue #18): an org that lost access to its own
 // ADMIN can't self-invite one (that route requires @Roles('ADMIN') within
 // the org), so SUPERADMIN provisions the invitation instead. Reuses the
 // same OrganizationInvitation the org's own ADMIN would create — the
 // recipient still sets their own password on accept.
 async inviteAdmin(organizationId: string, dto: CreatePlatformOrganizationAdminDto, actorId: string) {
  const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new NotFoundException('Organization not found');
  const existing = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
  if (existing) throw new ConflictException('A user with this email already belongs to this organization');

  const token = this.token(); const expiresAt = new Date(Date.now() + 7 * 86400000);
  const invitation = await this.prisma.$transaction(async tx => {
   const created = await tx.organizationInvitation.upsert({
    where: { organizationId_email: { organizationId, email: dto.email } },
    create: { organizationId, email: dto.email, role: 'ADMIN', tokenHash: token.hash, expiresAt, invitedById: actorId },
    update: { role: 'ADMIN', tokenHash: token.hash, expiresAt, status: 'PENDING', acceptedAt: null, invitedById: actorId },
   });
   await tx.auditLog.create({ data: { actorId, action: 'ORGANIZATION_ADMIN_RECOVERY_INVITED', organizationId, metadata: { invitationId: created.id } } });
   return created;
  });
  return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, invitationToken: token.raw };
 }
}
