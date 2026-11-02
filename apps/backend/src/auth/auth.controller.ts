import { ParseAuthTokenPipe } from '@/common/pipes/parse-auth-token.pipe';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  HttpStatus,
  Param,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthGuard } from './google-auth.guard';
import { Response } from 'express';
import { AccountDeactivatedException, AuthService } from './auth.service';
import { Public, CurrentUser } from '@/common/auth';
import type { AuthUser } from '@/common/auth';
import type { GoogleProfile } from './google.strategy';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResolveOrganizationDto } from './dto/resolve-organization.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import { Roles, RolesGuard } from '@/common/auth';
import { AuthRateLimit } from './auth-rate-limit';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @AuthRateLimit('register')
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @AuthRateLimit('login')
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @AuthRateLimit('platformLogin')
  @Post('platform-login')
  async platformLogin(@Body() dto: PlatformLoginDto) {
    return this.authService.platformLogin(dto);
  }

  @Public()
  @Post('resolve-organization')
  async resolveOrganization(@Body() dto: ResolveOrganizationDto) { return this.authService.resolveOrganization(dto.slug); }

  @Public()
  @Get('invitations/:token')
  async invitation(@Param('token', ParseAuthTokenPipe) token: string) { return this.authService.invitation(token); }

  @Public()
  @AuthRateLimit('acceptInvitation')
  @Post('invitations/:token/accept')
  async acceptInvitation(@Param('token', ParseAuthTokenPipe) token: string, @Body() dto: AcceptInvitationDto) { return this.authService.acceptInvitationWithTokens(token, dto); }

  @Public()
  @AuthRateLimit('acceptInvitation')
  @Post('password-reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) { return this.authService.resetPassword(dto.token, dto.password); }

  @Public()
  @AuthRateLimit('forgotPassword')
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) { return this.authService.requestPasswordReset(dto.organizationSlug, dto.email); }

  /** #110: public, tells the login/register pages which sign-in providers are configured. */
  @Public()
  @Get('providers')
  providers() { return { google: Boolean(this.config.get<string>('GOOGLE_CLIENT_ID')?.trim()) }; }

  @Post('admin/users/:id/password-reset')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async adminPasswordReset(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.authService.issueAdminPasswordReset(id, { userId: user.userId, organizationId: user.organizationId });
  }

  @Public()
  @AuthRateLimit('refresh')
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser, @Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Public()
  @AuthRateLimit('verifyEmail')
  @Get('verify-email')
  // The verification link carries a signed JWT, not the opaque hex token of invitations;
  // the service verifies signature, purpose and expiry and answers 400 in Spanish.
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Passport redirects to Google consent screen — this body is never reached.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: { user: GoogleProfile; googleOrganizationSlug?: string },
    @Res() res: Response,
  ) {
    const frontendUrl = this.frontendUrl();
    if (!req.googleOrganizationSlug) {
      res.redirect(`${frontendUrl}/auth/callback#error=invalid_state`);
      return;
    }
    try {
      const { accessToken, refreshToken } = await this.authService.googleLogin(
        req.user,
        req.googleOrganizationSlug,
      );
      const hash = new URLSearchParams({ accessToken, refreshToken }).toString();
      res.redirect(`${frontendUrl}/auth/callback#${hash}`);
    } catch (error) {
      const code =
        error instanceof AccountDeactivatedException
          ? 'account_deactivated'
          : error instanceof UnauthorizedException
          ? 'unknown_organization'
          : error instanceof ForbiddenException
            ? 'wrong_organization'
            : 'oauth_failed';
      res.redirect(`${frontendUrl}/auth/callback#error=${code}`);
    }
  }

  private frontendUrl(): string {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
  }
}
