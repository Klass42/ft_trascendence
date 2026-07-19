import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

// Owner: David (@dacs-dev) — Ops & Interaction (see docs/planning/David.md)
//
// Real-time WebSockets module. Holds the gateway plus the presence read side
// (PresenceService/Controller). It reaches the DB via the global PrismaModule
// and receives notifications via the app event bus (@nestjs/event-emitter), so
// it neither imports nor is imported by NotificationsModule — zero coupling, no
// circular dependency.
@Module({
  controllers: [PresenceController],
  providers: [RealtimeGateway, PresenceService],
})
export class RealtimeModule {}
