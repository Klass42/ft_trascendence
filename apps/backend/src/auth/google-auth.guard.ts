import { BadRequestException, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

const ORG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Starts Google OAuth with the organization slug in `state`.
 * The callback (Google sends `code` or `error`) must not re-validate that query.
 * Passport failures on that callback redirect to the SPA. They never reach the controller.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ query?: Record<string, unknown> }>();
    const query = req.query ?? {};
    const isCallback = typeof query.code === 'string' || typeof query.error === 'string';
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      if (!isCallback) throw error;
      const res = context.switchToHttp().getResponse<{ redirect: (url: string) => void }>();
      res.redirect(`${this.frontendUrl()}/auth/callback#error=oauth_failed`);
      // false makes Nest raise ForbiddenException. The redirect already flushed
      // the response, and the exception filter does not replace a sent reply.
      return false;
    }
  }

  private frontendUrl(): string {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ query?: Record<string, unknown> }>();
    const query = req.query ?? {};
    if (typeof query.code === 'string' || typeof query.error === 'string') return {};

    const slug = typeof query.organizationSlug === 'string' ? query.organizationSlug : '';
    if (!ORG_SLUG.test(slug)) {
      throw new BadRequestException('Organization code is required');
    }
    return { state: slug };
  }
}
