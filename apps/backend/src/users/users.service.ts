import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const selectUser = {
  id: true, email: true, name: true, avatarUrl: true,
  role: true, bio: true, onlineAt: true, emailVerifiedAt: true,
  organizationId: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: selectUser,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: selectUser });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    return user;
  }

  async create(dto: CreateUserDto, organizationId: string) {
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
    if (existing) throw new ConflictException('Email already registered in this organization');
    const isDev = process.env.NODE_ENV !== 'production';
    return this.prisma.user.create({
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
  }

  async update(id: string, dto: UpdateUserDto, organizationId: string, callerUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { ...selectUser, passwordHash: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    if (dto.role !== undefined && id === callerUserId) throw new BadRequestException('Cannot change your own role');
    return this.prisma.user.update({ where: { id }, data: dto, select: selectUser });
  }

  async remove(id: string, organizationId: string, callerUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { organizationId: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    if (id === callerUserId) throw new BadRequestException('Cannot delete yourself');
    await this.prisma.user.delete({ where: { id } });
  }
}
