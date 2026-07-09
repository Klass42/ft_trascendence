import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from '@/common/auth';
import type { AuthUser } from '@/common/auth';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser, @Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
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
}
