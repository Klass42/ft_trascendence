import { BadRequestException, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const ORG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Starts Google OAuth with the organization slug in `state`.
 * The callback (Google sends `code` or `error`) must not re-validate that query.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
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
