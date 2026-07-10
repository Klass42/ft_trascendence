import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

// Owner: David (@dacs-dev) — Ops & Interaction (see docs/planning/David.md)
//
// Real-time WebSockets module. Holds only the gateway. It reaches the DB via the
// global PrismaModule and receives notifications via the app event bus
// (@nestjs/event-emitter), so it neither imports nor is imported by
// NotificationsModule — zero coupling, no circular dependency.
@Module({
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
