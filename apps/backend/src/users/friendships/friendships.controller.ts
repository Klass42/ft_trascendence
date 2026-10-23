import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { FriendshipsService } from './friendships.service';
import { UpdateFriendshipDto } from './dto/update-friendship.dto';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('friendships')
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Get()
  async listMine(@CurrentUser() user: AuthUser) {
    return this.friendshipsService.listMine(user.userId, user.organizationId);
  }

  @Patch(':id')
  async updateStatus(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateFriendshipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.friendshipsService.updateStatus(id, dto.status, user.userId, user.organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.friendshipsService.remove(id, user.userId, user.organizationId);
  }
}
