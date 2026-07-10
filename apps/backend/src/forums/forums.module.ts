import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ForumsController } from './forums.controller';
import { ForumsService } from './forums.service';

// Owner: David (@dacs-dev) — Ops & Interaction (see docs/planning/David.md)
// Sub-resources live inside this folder so app.module.ts stays put.
@Module({
  // NotificationsModule exports NotificationsService (Epic A) so a new reply can
  // emit() FORUM_REPLY to the thread/parent-post authors.
  imports: [NotificationsModule],
  controllers: [ForumsController],
  providers: [ForumsService],
})
export class ForumsModule {}
