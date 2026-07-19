import { Controller, Get } from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { PresenceService } from './presence.service';

// Owner: David (@dacs-dev) — presence read endpoint (A6b).
@Controller()
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  /** The acting user's accepted friends with their current online status. */
  @Get('me/presence/friends')
  async friends(@CurrentUser() user: AuthUser) {
    return this.presence.getFriendsPresence(user.userId);
  }
}
