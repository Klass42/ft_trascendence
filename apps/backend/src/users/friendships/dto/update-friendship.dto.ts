import { IsEnum } from 'class-validator';
import { FriendStatus } from '@prisma/client';

export class UpdateFriendshipDto {
  @IsEnum(FriendStatus)
  status: 'ACCEPTED' | 'BLOCKED';
}
