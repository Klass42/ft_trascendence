import { assertUserLimit, assertCourseLimit, assertStorageLimit } from '@/common/plan-limits/plan-limits';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthUser } from '@/common/auth/auth-user.type';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto';
import type { PlatformLoginDto } from './dto/platform-login.dto';


/** #134: the account exists but was removed (deactivated) from its organization. */
export class AccountDeactivatedException extends ForbiddenException {
  constructor() { super('Tu cuenta se ha desactivado en esta organización. Contacta con su administración para reactivarla.'); }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private mapUser(user: {
    id: string; email: string; name: string; avatarUrl: string | null;
    organizationId: string | null; role: 'ADMIN' | 'TEACHER' | 'STUDENT'; platformRole: 'NONE' | 'SUPERADMIN';
    emailNotificationsEnabled: boolean; preferredLanguage: string;
  }): AuthUser {
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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private verifyRefreshToken(token: string, secret: string): { sub: string; jti: string } {
    let decoded: unknown;
    try {
      decoded = this.jwt.verify(token, { secret });
    } catch {
      throw new UnauthorizedException('La sesión no es válida. Inicia sesión de nuevo.');
    }
    if (typeof decoded !== 'object' || decoded === null) {
      throw new UnauthorizedException('La sesión no es válida. Inicia sesión de nuevo.');
    }
    const claims = decoded as { sub?: unknown; jti?: unknown; purpose?: unknown };
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.jti !== 'string' ||
      claims.jti.length === 0 ||
      claims.purpose !== 'refresh'
    ) {
      throw new UnauthorizedException('La sesión no es válida. Inicia sesión de nuevo.');
    }
    return { sub: claims.sub, jti: claims.jti };
  }

  /**
   * Session hashes are unique. A refresh token needs the newly-created session
   * ID in its `jti`, so the final hash cannot be calculated until after the
   * row exists. Use a cryptographically random, unique bootstrap value for
   * that short interval; a shared literal made concurrent logins fail.
   */
  private sessionBootstrapHash(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async activeOrganization(slug: string) {
    const organization = await this.prisma.organization.findUnique({ where: { slug } });
    if (!organization || organization.status !== 'ACTIVE') throw new UnauthorizedException('Organización o credenciales no válidas.');
    return organization;
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
        refreshTokenHash: this.sessionBootstrapHash(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const refreshToken = this.jwt.sign(
      { sub: userId, jti: session.id, purpose: 'refresh' },
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
    // #110: un registro con un código inexistente o suspendido no es un problema de «credenciales».
    const organization = await this.prisma.organization.findUnique({ where: { slug: dto.organizationSlug! } });
    if (!organization || organization.status !== 'ACTIVE') {
      throw new BadRequestException('No hay ninguna organización activa con ese código. Revisa el código que te ha dado tu centro.');
    }

    const existing = await this.prisma.user.findFirst({
      where: { organizationId: organization.id, email: dto.email },
    });
    if (existing) {
      // #110: mensaje genérico (no confirma de forma explícita qué cuentas existen).
      throw new ConflictException('No se ha podido crear la cuenta con estos datos. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña.');
    }

    await assertUserLimit(this.prisma as any, organization.id);
    const isDev = process.env.NODE_ENV !== 'production';
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        organizationId: organization.id,
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: 'STUDENT',
        emailVerifiedAt: isDev ? new Date() : null,
      },
    });

    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const verifyToken = this.jwt.sign(
      { sub: user.id, purpose: 'email-verify' },
      { secret: accessSecret, expiresIn: '30m' },
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Auth] Email verification link: /api/auth/verify-email?token=${verifyToken}`);
    }

    await this.notifyAdmins(
      organization.id,
      user.id,
      'Nuevo registro en la organización',
      `${user.name} (${user.email}) se ha registrado como estudiante.`,
      `/admin/users/${user.id}`,
    );

    const tokens = await this.issueTokens(user.id);
    return { user: this.mapUser(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.prisma.user.findFirst({ where: { organization: { slug: dto.organizationSlug! }, email: dto.email }, include: { organization: { select: { status: true } } } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos.');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos.');
    }

    // Issue #106: only after a valid password, tell the user the org is suspended.
    if (user.organization && user.organization.status !== 'ACTIVE') {
      throw new ForbiddenException('Tu organización está suspendida. Contacta con el soporte de la plataforma.');
    }

    // #134: a member removed from the org keeps the account but cannot sign in.
    if (user.deactivatedAt) {
      throw new ForbiddenException('Tu cuenta se ha desactivado en esta organización. Contacta con su administración para reactivarla.');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Confirma tu correo electrónico antes de iniciar sesión.');
    }

    const tokens = await this.issueTokens(user.id);
    return { user: this.mapUser(user), ...tokens };
  }

  async platformLogin(dto: PlatformLoginDto): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findFirst({
      where: { organizationId: null, platformRole: 'SUPERADMIN', email: dto.email },
    });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos.');
    }
    const tokens = await this.issueTokens(user.id);
    return { user: this.mapUser(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const claims = this.verifyRefreshToken(refreshToken, refreshSecret);
    const hash = this.hashToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { include: { organization: true } } },
    });

    if (!session) {
      await this.prisma.session.deleteMany({ where: { userId: claims.sub } });
      throw new UnauthorizedException('La sesión no es válida. Inicia sesión de nuevo.');
    }

    if (claims.sub !== session.userId || claims.jti !== session.id) {
      throw new UnauthorizedException('La sesión no es válida. Inicia sesión de nuevo.');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('La sesión ha caducado. Inicia sesión de nuevo.');
    }
    if (session.user.organization && session.user.organization.status !== 'ACTIVE') {
      await this.prisma.session.deleteMany({ where: { userId: session.userId } });
      throw new UnauthorizedException('Tu organización está suspendida.');
    }

    if (session.user.deactivatedAt) {
      await this.prisma.session.deleteMany({ where: { userId: session.userId } });
      throw new UnauthorizedException('Tu cuenta se ha desactivado en esta organización. Contacta con su administración para reactivarla.');
    }

    await this.prisma.session.delete({ where: { id: session.id } });

    const newSession = await this.prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: this.sessionBootstrapHash(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const newRefreshToken = this.jwt.sign(
      { sub: session.userId, jti: newSession.id, purpose: 'refresh' },
      { secret: refreshSecret, expiresIn: '7d' },
    );
    const newRefreshHash = this.hashToken(newRefreshToken);
    await this.prisma.session.update({
      where: { id: newSession.id },
      data: { refreshTokenHash: newRefreshHash },
    });

    const newAccessToken = this.jwt.sign(
      { sub: session.userId },
      { secret: accessSecret, expiresIn: '15m' },
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
    });
    if (session) {
      await this.prisma.session.delete({ where: { id: session.id } });
    }
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión de nuevo.');
    }
    if (!user.passwordHash) {
      throw new BadRequestException('Tu cuenta usa inicio de sesión con Google y no tiene contraseña.');
    }
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.notifySecurity(user, 'Has cambiado tu contraseña', 'Se ha cerrado tu sesión en todos los dispositivos. Si no has sido tú, avisa a tu organización.');
    return { changed: true };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('La cuenta ya no existe.');
    }
    return this.mapUser(user);
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    let payload: unknown;
    try {
      payload = this.jwt.verify(token, { secret: accessSecret });
    } catch {
      throw new BadRequestException('El enlace de verificación no es válido o ha caducado.');
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new BadRequestException('El enlace de verificación no es válido o ha caducado.');
    }
    const decoded = payload as { sub?: unknown; purpose?: unknown };
    if (typeof decoded.sub !== 'string' || decoded.purpose !== 'email-verify') {
      throw new BadRequestException('El enlace de verificación no es válido o ha caducado.');
    }
    try {
      await this.prisma.user.update({
        where: { id: decoded.sub },
        data: { emailVerifiedAt: new Date() },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        throw new BadRequestException('El enlace de verificación no es válido o ha caducado.');
      }
      throw error;
    }
    return { verified: true };
  }

  async googleLogin(
    profile: {
      providerUserId: string;
      email: string;
      name: string;
      avatarUrl: string | null;
    },
    organizationSlug: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const organization = await this.activeOrganization(organizationSlug);
    const email = profile.email?.trim().toLowerCase();
    if (!email) throw new UnauthorizedException('La cuenta de Google no tiene correo electrónico.');

    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'google',
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (oauthAccount) {
      if (oauthAccount.user.organizationId !== organization.id) {
        throw new ForbiddenException('Esta cuenta de Google está vinculada a otra organización.');
      }
      if (oauthAccount.user.deactivatedAt) throw new AccountDeactivatedException();
      return this.issueTokens(oauthAccount.userId);
    }

    let user = await this.prisma.user.findFirst({
      where: {
        organizationId: organization.id,
        email: { equals: email, mode: 'insensitive' },
      },
    });

    if (user?.deactivatedAt) throw new AccountDeactivatedException();

    if (!user) {
      await assertUserLimit(this.prisma as any, organization.id);
      user = await this.prisma.user.create({
        data: {
          organizationId: organization.id,
          email,
          name: profile.name?.trim() || email,
          avatarUrl: profile.avatarUrl,
          passwordHash: null,
          role: 'STUDENT',
          emailVerifiedAt: new Date(),
        },
      });
    } else if (!user.emailVerifiedAt) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerUserId: profile.providerUserId,
      },
    });

    return this.issueTokens(user.id);
  }

  async resolveOrganization(slug: string) {
    // #110: only public branding of ACTIVE organizations; suspended and unknown codes look the same
    // (404, not 401, so the client never tries a token refresh).
    const organization = await this.prisma.organization.findUnique({ where: { slug }, select: { name: true, slug: true, logoUrl: true, primaryColor: true, status: true } });
    if (!organization || organization.status !== 'ACTIVE') throw new NotFoundException('No hay ninguna organización activa con ese código.');
    const { status: _status, ...branding } = organization;
    return branding;
  }

  async invitation(token: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({ where: { tokenHash: this.hashToken(token) }, include: { organization: true } });
    // 404/410 (not 401): an invalid link must not trigger the client's token-refresh flow.
    if (!invitation) throw new NotFoundException('Esta invitación no existe.');
    if (invitation.status !== 'PENDING' || invitation.expiresAt <= new Date() || invitation.organization.status !== 'ACTIVE') throw new GoneException('Esta invitación ya se ha usado, se ha revocado o ha caducado.');
    return { email: invitation.email, role: invitation.role, organization: { name: invitation.organization.name, slug: invitation.organization.slug, logoUrl: invitation.organization.logoUrl, primaryColor: invitation.organization.primaryColor } };
  }

  // #74: aceptar invitación auto-verifica (emailVerifiedAt = now). El registro público queda sin
  // verificación posible en prod (sin SMTP) por decisión de producto; el enlace solo se loguea fuera de prod.
  async acceptInvitation(token: string, dto: AcceptInvitationDto) {
    const tokenHash = this.hashToken(token);
    const now = new Date();
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const invitation = await tx.organizationInvitation.findUnique({ where: { tokenHash }, include: { organization: true } });
        if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= now || invitation.organization.status !== 'ACTIVE') throw new UnauthorizedException('La invitación no es válida o ha caducado.');
        const existing = await tx.user.findFirst({ where: { organizationId: invitation.organizationId, email: invitation.email } });
        if (existing) throw new ConflictException('Este correo electrónico ya está registrado en la organización.');
        await assertUserLimit(tx as any, invitation.organizationId);
        const claimed = await tx.organizationInvitation.updateMany({ where: { id: invitation.id, status: 'PENDING' }, data: { status: 'ACCEPTED', acceptedAt: now } });
        if (claimed.count !== 1) throw new UnauthorizedException('La invitación no es válida o ha caducado.');
        const user = await tx.user.create({ data: { organizationId: invitation.organizationId, email: invitation.email, name: dto.name, passwordHash: await argon2.hash(dto.password), role: invitation.role, emailVerifiedAt: now } });
        await tx.auditLog.create({ data: { action: 'INVITATION_ACCEPTED', organizationId: invitation.organizationId, targetUserId: user.id, metadata: { role: invitation.role } } });
        return user;
      });
      if (created.organizationId) {
        await this.notifyAdmins(
          created.organizationId,
          created.id,
          'Una invitación ha sido aceptada',
          `${created.name} (${created.email}) ya forma parte de la organización.`,
          `/admin/users/${created.id}`,
        );
      }
      return created;
    } catch (error) { if (error instanceof ConflictException || error instanceof UnauthorizedException) throw error; throw error; }
  }

  async acceptInvitationWithTokens(token: string, dto: AcceptInvitationDto) {
    const user = await this.acceptInvitation(token, dto);
    return { user: this.mapUser(user), ...(await this.issueTokens(user.id)) };
  }

  /** Fingerprint of the current password: a reset link dies once the password changes. */
  private passwordFingerprint(passwordHash: string | null): string {
    return crypto.createHash('sha256').update(passwordHash ?? 'no-password').digest('hex').slice(0, 32);
  }

  /** Admin issues a one-use password reset link for another member of their organization. */
  async issueAdminPasswordReset(targetUserId: string, actor: { userId: string; organizationId: string }) {
    if (targetUserId === actor.userId) throw new BadRequestException('Para cambiar tu propia contraseña usa tu perfil.');
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, organizationId: true, passwordHash: true, email: true, name: true } });
    if (!user || user.organizationId !== actor.organizationId) throw new NotFoundException('Usuario no encontrado.');
    const ttlHours = 24;
    const resetToken = this.jwt.sign(
      { sub: user.id, purpose: 'password-reset', fp: this.passwordFingerprint(user.passwordHash) },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: `${ttlHours}h` },
    );
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
    await this.prisma.auditLog.create({ data: { actorId: actor.userId, action: 'PASSWORD_RESET_ISSUED', organizationId: actor.organizationId, targetUserId: user.id, metadata: { email: user.email } } });
    await this.notifications?.emitMany(
      [user.id],
      NotificationType.USER_CHANGED,
      { title: 'Restablecimiento de contraseña', body: 'Un administrador ha generado un enlace para restablecer tu contraseña. Si no lo esperabas, contacta con tu organización.', link: '/profile' },
      { organizationId: actor.organizationId, actorId: actor.userId },
    );
    return { resetToken, expiresAt, email: user.email, name: user.name };
  }

  async resetPassword(token: string, password: string): Promise<{ reset: true }> {
    const invalid = () => new BadRequestException('El enlace para restablecer la contraseña no es válido o ha caducado.');
    let decoded: { sub?: unknown; purpose?: unknown; fp?: unknown };
    try {
      decoded = this.jwt.verify(token, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') });
    } catch {
      throw invalid();
    }
    if (typeof decoded !== 'object' || decoded === null || typeof decoded.sub !== 'string' || decoded.purpose !== 'password-reset') throw invalid();
    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub }, select: { id: true, organizationId: true, passwordHash: true } });
    if (!user || decoded.fp !== this.passwordFingerprint(user.passwordHash)) throw invalid();
    const passwordHash = await argon2.hash(password);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.prisma.session.deleteMany({ where: { userId: user.id } });
    await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'PASSWORD_RESET_COMPLETED', organizationId: user.organizationId, targetUserId: user.id } });
    await this.notifySecurity(user, 'Tu contraseña se ha restablecido', 'Se ha cerrado tu sesión en todos los dispositivos. Si no has sido tú, avisa a tu organización.');
    return { reset: true };
  }

  /**
   * #110: self-service "forgot password". There is no SMTP yet, so the link cannot be mailed:
   * the request always answers the same generic 200 (no account enumeration), and when the
   * account exists the organization admins get a notification to issue the one-use link
   * from Usuarios (same flow as #108). Outside production the link is also logged.
   */
  async requestPasswordReset(organizationSlug: string, email: string): Promise<{ requested: true }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { organization: { slug: organizationSlug, status: 'ACTIVE' }, email: { equals: normalized, mode: 'insensitive' } },
      select: { id: true, organizationId: true, passwordHash: true, name: true, email: true },
    });
    if (user?.organizationId) {
      await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'PASSWORD_RESET_REQUESTED', organizationId: user.organizationId, targetUserId: user.id, metadata: { email: user.email } } });
      const organizationId = user.organizationId;
      await this.notifications?.emitMany(
        async () => (await this.prisma.user.findMany({ where: { organizationId, role: 'ADMIN' }, select: { id: true } })).map((admin) => admin.id),
        NotificationType.USER_CHANGED,
        { title: 'Solicitud de restablecimiento de contraseña', body: `${user.name} (${user.email}) ha pedido restablecer su contraseña. Genera un enlace desde Usuarios y envíaselo.`, link: `/admin/users/${user.id}` },
        { organizationId, actorId: user.id },
      );
      if (process.env.NODE_ENV !== 'production') {
        const token = this.jwt.sign(
          { sub: user.id, purpose: 'password-reset', fp: this.passwordFingerprint(user.passwordHash) },
          { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '1h' },
        );
        console.log(`[Auth] Password reset link: /reset-password#token=${token}`);
      }
    }
    return { requested: true };
  }

  /** Org admins (never the actor). */
  private async notifyAdmins(organizationId: string, actorId: string, title: string, body: string, link: string) {
    await this.notifications?.emitMany(
      async () => (await this.prisma.user.findMany({ where: { organizationId, role: 'ADMIN' }, select: { id: true } })).map((admin) => admin.id),
      NotificationType.USER_CHANGED,
      { title, body, link },
      { organizationId, actorId },
    );
  }

  /** Security notice for the account owner themself: deliberately no `actorId`, the owner is the one to alert. */
  private async notifySecurity(user: { id: string; organizationId: string | null }, title: string, body: string) {
    await this.notifications?.emitMany(
      [user.id],
      NotificationType.USER_CHANGED,
      { title, body, link: '/profile' },
      { organizationId: user.organizationId ?? undefined },
    );
  }
}
