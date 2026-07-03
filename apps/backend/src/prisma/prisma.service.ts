import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma connection for the whole app.
 * Inject this anywhere (PrismaModule is @Global) to reach the database.
 *
 * Reminder (AGENTS.md §5): every tenant-scoped query MUST filter by
 * `organizationId`. Isolation is enforced here in the app layer, not by RLS.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
