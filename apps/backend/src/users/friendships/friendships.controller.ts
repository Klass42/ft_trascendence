import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { FriendshipsService } from './friendships.service';
import { UpdateFriendshipDto } from './dto/update-friendship.dto';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('friendships')
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFriendshipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.friendshipsService.updateStatus(id, dto.status, user.userId);
  }
}
