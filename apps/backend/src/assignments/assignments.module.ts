import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { SubmissionsController } from './submissions/submissions.controller';
import { SubmissionsService } from './submissions/submissions.service';

// Owner: David (@dacs-dev) — Ops & Interaction (see docs/planning/David.md)
// Sub-resources (submissions) live inside this folder so app.module.ts stays put.
@Module({
  // NotificationsModule exports NotificationsService (Epic A) so submissions can
  // emit() to course staff. File storage is reused via the shared /files
  // endpoint (FilesService) — the frontend uploads there first and we link ids.
  imports: [NotificationsModule],
  controllers: [AssignmentsController, SubmissionsController],
  providers: [AssignmentsService, SubmissionsService],
})
export class AssignmentsModule {}
