import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Creates exactly one configured platform account when the application starts.
 * It intentionally has no organizationId: platform authority is distinct from
 * tenant membership. Existing accounts are never password-reset at startup.
 */
@Injectable()
export class PlatformBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformBootstrapService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('PLATFORM_SUPERADMIN_EMAIL')?.trim().toLowerCase();
    if (!email) return;

    const password = this.config.get<string>('PLATFORM_SUPERADMIN_PASSWORD');
    const name = this.config.get<string>('PLATFORM_SUPERADMIN_NAME')?.trim() || 'Platform Administrator';
    if (!password || password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('PLATFORM_SUPERADMIN_PASSWORD must be at least 8 characters and include uppercase, lowercase, and a number');
    }

    const existing = await this.prisma.user.findFirst({
      where: { email, organizationId: null },
      select: { id: true, platformRole: true },
    });
    if (existing) {
      if (existing.platformRole !== 'SUPERADMIN') {
        await this.prisma.user.update({ where: { id: existing.id }, data: { platformRole: 'SUPERADMIN' } });
      }
      return;
    }

    await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await argon2.hash(password),
        emailVerifiedAt: new Date(),
        platformRole: 'SUPERADMIN',
        // `role` is irrelevant to platform authorization but remains required by the schema.
        role: 'STUDENT',
      },
    });
    this.logger.log(`Bootstrapped platform superadmin ${email}`);
  }
}
