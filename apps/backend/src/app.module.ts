import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelemetryModule } from './telemetry/telemetry.module';
import { PrismaModule } from './prisma/prisma.module';

// ── Identity & Access — SrJorgeG ──
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
// ── Content & UX — illia ──
import { CoursesModule } from './courses/courses.module';
import { FilesModule } from './files/files.module';
// ── Ops & Interaction — dacs-dev ──
import { AssignmentsModule } from './assignments/assignments.module';
import { ForumsModule } from './forums/forums.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelemetryModule,
    PrismaModule,
    // Feature modules (owned per docs/planning). Add sub-resources INSIDE each
    // module's folder so this file rarely needs to change.
    AuthModule,
    UsersModule,
    OrganizationsModule,
    CoursesModule,
    FilesModule,
    AssignmentsModule,
    ForumsModule,
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
