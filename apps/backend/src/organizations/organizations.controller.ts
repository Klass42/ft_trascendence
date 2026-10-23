import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
  Post,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CurrentUser, AuthUser, Roles, RolesGuard } from '@/common/auth';
import { tenantId } from '@/common/auth';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  async findMine(@CurrentUser() user: AuthUser) {
    return this.organizationsService.findMyOrganization(tenantId(user));
  }

  @Post('me/invitations') @UseGuards(RolesGuard) @Roles('ADMIN')
  invite(@Body() dto: CreateInvitationDto, @CurrentUser() user: AuthUser) { return this.organizationsService.invite(tenantId(user), user.userId, dto); }

  @Post('me/invitations/:id/revoke') @UseGuards(RolesGuard) @Roles('ADMIN')
  revokeInvitation(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) { return this.organizationsService.revokeInvitation(tenantId(user), id, user.userId); }

  @Post('me/deletion-request')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  requestDeletion(@CurrentUser() user: AuthUser) {
    return this.organizationsService.requestDeletion(tenantId(user), {
      userId: user.userId,
      name: user.name,
      email: user.email,
    });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizationsService.update(id, dto, user.organizationId);
  }

  @Get(':id/members')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findMembers(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListMembersQueryDto,
  ) {
    return this.organizationsService.findMembers(id, user.organizationId, query);
  }

  @Get('me/deletion-request')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getDeletionRequestStatus(@CurrentUser() user: AuthUser) {
    return this.organizationsService.getDeletionRequestStatus(tenantId(user));
  }

  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseIdPipe) id: string,
    @Param('userId', ParseIdPipe) userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.organizationsService.removeMember(
      id, userId, user.organizationId, user.userId,
    );
  }
}
