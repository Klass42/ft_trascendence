import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, PlatformRoles, PlatformRolesGuard, type AuthUser } from '@/common/auth';
import { PlatformService } from './platform.service';
import { CreatePlatformOrganizationDto } from './dto/create-platform-organization.dto';
import { UpdatePlatformOrganizationDto } from './dto/update-platform-organization.dto';
import { CreatePlatformOrganizationAdminDto } from './dto/create-platform-organization-admin.dto';
@Controller('platform/organizations') @UseGuards(PlatformRolesGuard) @PlatformRoles('SUPERADMIN')
export class PlatformController { constructor(private readonly service: PlatformService) {}
 @Post() create(@Body() dto: CreatePlatformOrganizationDto, @CurrentUser() user: AuthUser) { return this.service.createOrganization(dto, user.userId); }
 @Get() list() { return this.service.listOrganizations(); }
 @Get(':id') get(@Param('id') id: string) { return this.service.getOrganization(id); }
 @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdatePlatformOrganizationDto, @CurrentUser() user: AuthUser) { return this.service.updateOrganization(id, dto, user.userId); }
 @Post(':id/suspend') suspend(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.service.suspend(id, user.userId); }
 @Post(':id/admins') inviteAdmin(@Param('id') id: string, @Body() dto: CreatePlatformOrganizationAdminDto, @CurrentUser() user: AuthUser) { return this.service.inviteAdmin(id, dto, user.userId); }
}
