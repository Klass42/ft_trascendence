import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

// Owner: David (@dacs-dev) — Interaction (see docs/planning/David.md, Epic 6).
// Read-only analytics over the data other modules already own; PrismaService is
// global so no feature imports are needed. Kept decoupled on purpose.
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
