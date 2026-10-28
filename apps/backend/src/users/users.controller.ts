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
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { CurrentUser, AuthUser, Roles, RolesGuard } from '@/common/auth';
import { MAX_AVATAR_UPLOAD_BYTES } from '@/files/file-validation';
import { UsersByIdsQueryDto } from './dto/users-by-ids-query.dto';
import { LookupUserQueryDto } from './dto/lookup-user-query.dto';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Public profile routes (any authenticated user) ──

  @Patch('me')
  async updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  /** GDPR-style export of the caller's own data (#111). */
  @Get('me/export')
  async exportMyData(@CurrentUser() user: AuthUser) {
    return this.usersService.exportOwnData(user.userId);
  }

  /** Irreversible self-deletion (#111). */
  @Post('me/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMyAccount(@Body() dto: DeleteAccountDto, @CurrentUser() user: AuthUser) {
    await this.usersService.deleteOwnAccount(user.userId, dto);
  }

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_UPLOAD_BYTES } }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    return this.usersService.uploadAvatar(user, file);
  }

  @Delete('me/avatar')
  async removeAvatar(@CurrentUser() user: AuthUser) {
    return this.usersService.removeAvatar(user);
  }

  @Get('me/friends')
  async listFriends(@CurrentUser() user: AuthUser) {
    return this.usersService.listFriends(user.userId, user.organizationId);
  }

  @Post(':id/friend')
  async sendFriendRequest(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.sendFriendRequest(user.userId, id, user.organizationId);
  }

  @Get('search')
  async search(@Query() query: SearchUsersDto, @CurrentUser() user: AuthUser) {
    return this.usersService.searchUsers(query.q, user.userId, user.organizationId);
  }

  // ── Roster support routes (A3) ──

  @Get('by-ids')
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN')
  async findByIds(@Query() query: UsersByIdsQueryDto, @CurrentUser() user: AuthUser) {
    return this.usersService.findByIds(query.ids ?? [], user.organizationId);
  }

  @Get('lookup')
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN')
  async lookupByEmail(@Query() query: LookupUserQueryDto, @CurrentUser() user: AuthUser) {
    return this.usersService.lookupByEmail(query.email, user.organizationId, user.role);
  }

  // ── Admin CRUD routes (Epic 5) ──

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user.organizationId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findOne(id, user.organizationId, user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user.organizationId, user.userId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user.organizationId, user.userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.usersService.remove(id, user.organizationId, user.userId);
  }
}
