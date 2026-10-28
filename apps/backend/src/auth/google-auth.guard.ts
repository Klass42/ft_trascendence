import { BadRequestException, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import * as crypto from 'crypto';

const ORG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATE_COOKIE = 'google_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

type GoogleOAuthRequest = {
  path?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  googleOAuthState?: string;
  googleOrganizationSlug?: string;
};

type GoogleOAuthResponse = {
  cookie: (name: string, value: string, options: Record<string, unknown>) => void;
  clearCookie: (name: string, options: Record<string, unknown>) => void;
  redirect: (url: string) => void;
};

type GoogleStatePayload = {
  nonce: string;
  organizationSlug: string;
  expiresAt: number;
};

/**
 * Binds OAuth state to a short-lived HttpOnly cookie in the browser. The slug is
 * covered by the state signature and is only used after the callback validates it.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<GoogleOAuthRequest>();
    const res = http.getResponse<GoogleOAuthResponse>();
    const query = req.query ?? {};
    const isCallback = req.path?.endsWith('/google/callback') === true;

    if (isCallback) {
      try {
        const state = query.state;
        const cookieState = this.readCookie(req, STATE_COOKIE);
        if (
          typeof state !== 'string' ||
          typeof cookieState !== 'string' ||
          !this.safeEqual(state, cookieState)
        ) {
          throw new Error('OAuth state is missing or does not match');
        }
        const payload = this.decodeState(state);
        if (typeof query.code !== 'string' && typeof query.error !== 'string') {
          throw new Error('OAuth callback data is missing');
        }
        req.googleOrganizationSlug = payload.organizationSlug;
        res.clearCookie(STATE_COOKIE, this.cookieOptions(false));
      } catch {
        res.clearCookie(STATE_COOKIE, this.cookieOptions(false));
        res.redirect(`${this.frontendUrl()}/auth/callback#error=invalid_state`);
        return false;
      }
    } else {
      const slug = typeof query.organizationSlug === 'string' ? query.organizationSlug : '';
      if (!ORG_SLUG.test(slug)) {
        throw new BadRequestException('El código de organización es obligatorio.');
      }

      const state = this.createState(slug);
      req.googleOAuthState = state;
      res.cookie(STATE_COOKIE, state, this.cookieOptions());
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      if (!isCallback) throw error;
      res.redirect(`${this.frontendUrl()}/auth/callback#error=oauth_failed`);
      // The redirect has already been sent; false prevents the controller running.
      return false;
    }
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<GoogleOAuthRequest>();
    if (req.path?.endsWith('/google/callback')) return {};
    if (!req.googleOAuthState) throw new BadRequestException('El código de organización es obligatorio.');
    return { state: req.googleOAuthState };
  }

  private createState(organizationSlug: string): string {
    const payload: GoogleStatePayload = {
      nonce: crypto.randomBytes(32).toString('hex'),
      organizationSlug,
      expiresAt: Date.now() + STATE_TTL_MS,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  private decodeState(state: string): GoogleStatePayload {
    const [encoded, signature, extra] = state.split('.');
    if (!encoded || !signature || extra !== undefined || !this.safeEqual(signature, this.sign(encoded))) {
      throw new Error('OAuth state signature is invalid');
    }

    let payload: GoogleStatePayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as GoogleStatePayload;
    } catch {
      throw new Error('OAuth state payload is invalid');
    }
    if (
      typeof payload.nonce !== 'string' ||
      !/^[a-f0-9]{64}$/.test(payload.nonce) ||
      typeof payload.organizationSlug !== 'string' ||
      !ORG_SLUG.test(payload.organizationSlug) ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) {
      throw new Error('OAuth state payload is invalid or expired');
    }
    return payload;
  }

  private sign(value: string): string {
    const secret =
      this.config.get<string>('GOOGLE_OAUTH_STATE_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('OAuth state signing secret is not configured');
    return crypto.createHmac('sha256', secret).update(value).digest('base64url');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBytes = Buffer.from(left);
    const rightBytes = Buffer.from(right);
    return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
  }

  private readCookie(req: GoogleOAuthRequest, name: string): string | undefined {
    const parsed = req.cookies?.[name];
    if (parsed) return parsed;
    const header = req.headers?.cookie;
    if (typeof header !== 'string') return undefined;
    const cookie = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return cookie?.slice(name.length + 1);
  }

  private cookieOptions(includeMaxAge = true): Record<string, unknown> {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      ...(includeMaxAge ? { maxAge: STATE_TTL_MS } : {}),
    };
  }

  private frontendUrl(): string {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
  }
}
