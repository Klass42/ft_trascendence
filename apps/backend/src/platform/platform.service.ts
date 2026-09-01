import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { CreatePlatformOrganizationDto } from './dto/create-platform-organization.dto';
import type { UpdatePlatformOrganizationDto } from './dto/update-platform-organization.dto';

@Injectable()
export class PlatformService {
 constructor(private readonly prisma: PrismaService) {}
 private token() { const raw = crypto.randomBytes(32).toString('base64url'); return { raw, hash: crypto.createHash('sha256').update(raw).digest('hex') }; }
 async createOrganization(dto: CreatePlatformOrganizationDto, actorId: string) {
  const token = this.token(); const expiresAt = new Date(Date.now() + 7 * 86400000);
  try { const result = await this.prisma.$transaction(async tx => {
   const organization = await tx.organization.create({ data: { name: dto.name, slug: dto.slug, logoUrl: dto.logoUrl, primaryColor: dto.primaryColor, defaultLanguage: dto.defaultLanguage, timezone: dto.timezone } });
   const invitation = await tx.organizationInvitation.create({ data: { organizationId: organization.id, email: dto.adminEmail, role: 'ADMIN', tokenHash: token.hash, expiresAt, invitedById: actorId } });
   await tx.auditLog.create({ data: { actorId, action: 'ORGANIZATION_PROVISIONED', organizationId: organization.id, metadata: { firstAdminEmail: dto.adminEmail, invitationId: invitation.id } } });
   return { organization, invitationId: invitation.id };
  }); return { ...result, invitationToken: token.raw }; } catch (error: any) { if (error?.code === 'P2002') throw new ConflictException('Organization slug already exists'); throw error; }
 }
 async listOrganizations() { return this.prisma.organization.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { users: true, invitations: { where: { status: 'PENDING' } } } } } }); }
 async getOrganization(id: string) { const org = await this.prisma.organization.findUnique({ where: { id }, include: { _count: { select: { users: true, invitations: true } } } }); if (!org) throw new NotFoundException('Organization not found'); return org; }
 async updateOrganization(id: string, dto: UpdatePlatformOrganizationDto, actorId: string) { const org = await this.prisma.organization.update({ where: { id }, data: dto }); await this.prisma.auditLog.create({ data: { actorId, action: 'ORGANIZATION_UPDATED', organizationId: id, metadata: dto as Prisma.InputJsonValue } }); return org; }
 async suspend(id: string, actorId: string) { const org = await this.prisma.$transaction(async tx => { const updated = await tx.organization.update({ where: { id }, data: { status: 'SUSPENDED' } }); const users = await tx.user.findMany({ where: { organizationId: id }, select: { id: true } }); await tx.session.deleteMany({ where: { userId: { in: users.map(u => u.id) } } }); await tx.auditLog.create({ data: { actorId, action: 'ORGANIZATION_SUSPENDED', organizationId: id } }); return updated; }); return org; }
}
