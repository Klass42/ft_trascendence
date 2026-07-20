import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { AttemptsController } from './attempts/attempts.controller';
import { AttemptsService } from './attempts/attempts.service';

// Owner: David (@dacs-dev) — Interaction. Activity engine (Phase B / B1):
// rich auto-gradable activities alongside the MANUAL Assignment/Submission flow.
// See docs/planning/David-B1-design.md. Decoupled from AssignmentsModule; the
// course membership gate is replicated locally (ActivitiesService).
@Module({
  // NotificationsModule exports NotificationsService so a graded attempt can
  // emit GRADE_PUBLISHED to the student (same pattern as submissions/grading).
  imports: [NotificationsModule],
  controllers: [ActivitiesController, AttemptsController],
  providers: [ActivitiesService, AttemptsService],
})
export class ActivitiesModule {}
