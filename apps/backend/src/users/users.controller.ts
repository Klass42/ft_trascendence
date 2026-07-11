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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser, AuthUser, Roles, RolesGuard } from '@/common/auth';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Public profile routes (any authenticated user) ──

  @Patch('me')
  async updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    return this.usersService.uploadAvatar(user.userId, user.organizationId, file);
  }

  @Get('me/friends')
  async listFriends(@CurrentUser() user: AuthUser) {
    return this.usersService.listFriends(user.userId);
  }

  @Post(':id/friend')
  async sendFriendRequest(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.sendFriendRequest(user.userId, id, user.organizationId);
  }

  // ── Admin CRUD routes (Epic 5) ──

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user.organizationId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findOne(id, user.organizationId, user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user.organizationId, user.userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.usersService.remove(id, user.organizationId, user.userId);
  }
}
