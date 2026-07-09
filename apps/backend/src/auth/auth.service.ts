import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthUser } from '@/common/auth/auth-user.type';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const SEED_ORG_ID = 'org-klass-0001';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private mapUser(user: {
    id: string; email: string; name: string; avatarUrl: string | null;
    organizationId: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  }): AuthUser {
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      role: user.role,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: 'placeholder',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const refreshToken = this.jwt.sign(
      { sub: userId, jti: session.id },
      { secret: refreshSecret, expiresIn: '7d' },
    );

    const refreshHash = this.hashToken(refreshToken);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: refreshHash },
    });

    const accessToken = this.jwt.sign(
      { sub: userId },
      { secret: accessSecret, expiresIn: '15m' },
    );

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const existing = await this.prisma.user.findFirst({
      where: { organizationId: SEED_ORG_ID, email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered in this organization');
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        organizationId: SEED_ORG_ID,
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: 'STUDENT',
        emailVerifiedAt: isDev ? new Date() : null,
      },
    });

    if (!isDev) {
      const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
      const verifyToken = this.jwt.sign(
        { sub: user.id, purpose: 'email-verify' },
        { secret: accessSecret, expiresIn: '30m' },
      );
      console.log(`[Auth] Email verification link: /api/auth/verify-email?token=${verifyToken}`);
    }

    const tokens = await this.issueTokens(user.id);
    return { user: this.mapUser(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { organizationId: SEED_ORG_ID, email: dto.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email not verified');
    }

    const tokens = await this.issueTokens(user.id);
    return { user: this.mapUser(user), ...tokens };
  }
}
