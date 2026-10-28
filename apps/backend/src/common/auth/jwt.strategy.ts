import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthUser } from './auth-user.type';

export interface JwtPayload {
  sub: string; // userId
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req) => {
        const auth = req?.headers?.authorization;
        if (!auth?.startsWith('Bearer ')) return null;
        return auth.slice(7);
      },
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /** Called by passport after the JWT is verified. Returns the AuthUser on req.user. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { organization: { select: { status: true } } } });
    if (!user) throw new UnauthorizedException('La cuenta ya no existe.');
    // Issue #106: cut access immediately when the organization is suspended.
    if (user.organization && user.organization.status !== 'ACTIVE') throw new UnauthorizedException('Tu organización está suspendida.');
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId ?? '',
      role: user.role,
      platformRole: user.platformRole,
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      preferredLanguage: user.preferredLanguage,
    };
  }
}
