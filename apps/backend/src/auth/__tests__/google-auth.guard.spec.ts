import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthGuard } from '../google-auth.guard';

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
});
