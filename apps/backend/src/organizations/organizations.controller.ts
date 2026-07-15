import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CurrentUser, AuthUser, Roles, RolesGuard } from '@/common/auth';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  async findMine(@CurrentUser() user: AuthUser) {
    return this.organizationsService.findMyOrganization(user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizationsService.update(id, dto, user.organizationId);
  }

  @Get(':id/members')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findMembers(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.organizationsService.findMembers(id, user.organizationId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.organizationsService.removeMember(
      id, userId, user.organizationId, user.userId,
    );
  }
}
