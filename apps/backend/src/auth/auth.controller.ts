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
import { AuthService } from './auth.service';
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

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('platform-login')
  async platformLogin(@Body() dto: PlatformLoginDto) {
    return this.authService.platformLogin(dto);
  }

  @Public()
  @Post('resolve-organization')
  async resolveOrganization(@Body() dto: ResolveOrganizationDto) { return this.authService.resolveOrganization(dto.slug); }

  @Public()
  @Get('invitations/:token')
  async invitation(@Param('token') token: string) { return this.authService.invitation(token); }

  @Public()
  @Post('invitations/:token/accept')
  async acceptInvitation(@Param('token') token: string, @Body() dto: AcceptInvitationDto) { return this.authService.acceptInvitationWithTokens(token, dto); }

  @Public()
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
  @Get('verify-email')
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
    @Req() req: { user: GoogleProfile; query: { state?: string | string[] } },
    @Res() res: Response,
  ) {
    const frontendUrl = this.frontendUrl();
    const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
    try {
      const { accessToken, refreshToken } = await this.authService.googleLogin(req.user, state ?? '');
      const hash = new URLSearchParams({ accessToken, refreshToken }).toString();
      res.redirect(`${frontendUrl}/auth/callback#${hash}`);
    } catch (error) {
      const code =
        error instanceof UnauthorizedException
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
