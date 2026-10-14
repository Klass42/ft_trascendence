import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthGuard } from '../google-auth.guard';
import { GoogleStrategy } from '../google.strategy';

const mkConfig = (overrides?: Record<string, string>) =>
  ({
    get: (key: string) => overrides?.[key] ?? null,
  }) as unknown as ConfigService;

function httpContext(query: Record<string, unknown>, redirect = jest.fn()) {
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ query }),
      getResponse: () => ({ redirect }),
    }),
  } as unknown as ExecutionContext;
  return { context, redirect };
}

describe('GoogleAuthGuard', () => {
  const parent = Object.getPrototypeOf(GoogleAuthGuard.prototype) as {
    canActivate: (context: ExecutionContext) => Promise<boolean>;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([{ error: 'access_denied' }, { code: 'auth-code' }])(
    'redirects a Passport failure on the callback (%j) to the SPA',
    async (query) => {
      jest.spyOn(parent, 'canActivate').mockRejectedValue(new UnauthorizedException());
      const guard = new GoogleAuthGuard(mkConfig({ FRONTEND_URL: 'https://localhost:4443/' }));
      const { context, redirect } = httpContext(query);

      await expect(guard.canActivate(context)).resolves.toBe(false);
      expect(redirect).toHaveBeenCalledWith(
        'https://localhost:4443/auth/callback#error=oauth_failed',
      );
    },
  );

  it('does not turn a start-route failure into a redirect', async () => {
    jest.spyOn(parent, 'canActivate').mockRejectedValue(new UnauthorizedException());
    const guard = new GoogleAuthGuard(mkConfig());
    const { context, redirect } = httpContext({ organizationSlug: 'klass' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('still rejects a start request without an organization slug', async () => {
    const guard = new GoogleAuthGuard(mkConfig());
    const { context, redirect } = httpContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('rejects an invalid slug with the organization-code error and does not redirect', async () => {
    const guard = new GoogleAuthGuard(mkConfig());
    const { context, redirect } = httpContext({ organizationSlug: 'Not A Slug' });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    await expect(guard.canActivate(context)).rejects.toThrow('Organization code is required');
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(['access_denied', 'temporarily_unavailable'])(
    'redirects a real passport failure for error=%s without calling Google',
    async (error) => {
      // Registers the strategy. passport-oauth2 handles `error` before any token request.
      new GoogleStrategy(
        mkConfig({
          GOOGLE_CLIENT_ID: 'test-google-client-id',
          GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
          GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
        }),
      );
      const guard = new GoogleAuthGuard(mkConfig({ FRONTEND_URL: 'https://localhost:4443/' }));
      const { context, redirect } = httpContext({ error });

      await expect(guard.canActivate(context)).resolves.toBe(false);
      expect(redirect).toHaveBeenCalledWith(
        'https://localhost:4443/auth/callback#error=oauth_failed',
      );
    },
  );

  it('uses the default frontend origin when FRONTEND_URL is unset', async () => {
    jest.spyOn(parent, 'canActivate').mockRejectedValue(new UnauthorizedException());
    const guard = new GoogleAuthGuard(mkConfig());
    const { context, redirect } = httpContext({ error: 'server_error' });

    await expect(guard.canActivate(context)).resolves.toBe(false);
    expect(redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback#error=oauth_failed');
  });

  describe('getAuthenticateOptions', () => {
    it('puts a valid organization slug in OAuth state', () => {
      const guard = new GoogleAuthGuard(mkConfig());
      const { context } = httpContext({ organizationSlug: 'klass-42' });

      expect(guard.getAuthenticateOptions(context)).toEqual({ state: 'klass-42' });
    });

    it.each([
      '',
      'Klass',
      'has space',
      'under_score',
      '-leading',
      'trailing-',
      'double--hyphen',
      'has.dot',
    ])('rejects invalid slug %j', (organizationSlug) => {
      const guard = new GoogleAuthGuard(mkConfig());
      const { context } = httpContext({ organizationSlug });

      expect(() => guard.getAuthenticateOptions(context)).toThrow(BadRequestException);
      expect(() => guard.getAuthenticateOptions(context)).toThrow('Organization code is required');
    });

    it.each([
      { error: 'access_denied' },
      { code: 'auth-code' },
      { error: 'server_error', organizationSlug: 'NOT A SLUG' },
      { code: 'auth-code', organizationSlug: '' },
    ])('does not re-validate the slug on a callback query %j', (query) => {
      const guard = new GoogleAuthGuard(mkConfig());
      const { context } = httpContext(query);

      expect(guard.getAuthenticateOptions(context)).toEqual({});
    });

    it('treats a non-string error as the start route', () => {
      const guard = new GoogleAuthGuard(mkConfig());
      const { context } = httpContext({ error: ['access_denied'] });

      expect(() => guard.getAuthenticateOptions(context)).toThrow('Organization code is required');
    });
  });
});
