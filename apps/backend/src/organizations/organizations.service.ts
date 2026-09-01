import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import * as crypto from 'crypto';

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

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async update(id: string, dto: UpdateOrganizationDto, callerOrgId: string) {
    if (id !== callerOrgId) {
      throw new ForbiddenException('Cannot edit an organization you do not belong to');
    }
    return this.prisma.organization.update({ where: { id }, data: dto });
  }

  async findMembers(id: string, callerOrgId: string): Promise<Member[]> {
    if (id !== callerOrgId) {
      throw new ForbiddenException('Cannot list members of another organization');
    }
    return this.prisma.user.findMany({
      where: { organizationId: id },
      select: {
        id: true, email: true, name: true, avatarUrl: true, role: true,
        bio: true, onlineAt: true, emailVerifiedAt: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
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
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, organizationId: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.organizationId !== id) throw new ForbiddenException('User belongs to another organization');
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
