import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';

export interface GoogleProfile {
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Passport strategy for Google OAuth 2.0.
 * Scopes: email + profile (needed to auto-create / link users).
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') || 'google-oauth-dev-not-configured';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || 'google-oauth-dev-not-configured';
    const callbackURL = config.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/auth/google/callback';
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
  ): Promise<GoogleProfile> {
    const email = profile.emails?.[0];
    // passport-google-oauth20 copies Google's email_verified onto emails[].verified.
    // Linking by address treats that email as proof of ownership.
    if (!email?.value || email.verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }
    return {
      providerUserId: profile.id,
      email: email.value,
      name: profile.displayName ?? '',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
