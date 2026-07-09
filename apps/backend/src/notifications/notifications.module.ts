import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Owner: David (@dacs-dev) — Ops & Interaction (see docs/planning/David.md)
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Exported so Assignments/Grading/Forums can inject it and call emit().
  exports: [NotificationsService],
})
export class NotificationsModule {}
