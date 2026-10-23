import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { GoogleAuthGuard } from '../google-auth.guard';

const mkConfig = (overrides?: Record<string, string>) =>
  ({
    get: (key: string) => overrides?.[key] ?? (key === 'JWT_ACCESS_SECRET' ? 'test-state-secret' : null),
  }) as unknown as ConfigService;

function httpContext(
  path: string,
  query: Record<string, unknown>,
  headers: Record<string, string | undefined> = {},
) {
  const request: Record<string, any> = { path, query, headers };
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  const redirect = jest.fn();
  const response = { cookie, clearCookie, redirect };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, request, cookie, clearCookie, redirect };
}

function signedState(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', 'test-state-secret').update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function validState(overrides: Record<string, unknown> = {}) {
  return signedState({
    nonce: 'a'.repeat(64),
    organizationSlug: 'klass-42',
    expiresAt: Date.now() + 60_000,
    ...overrides,
  });
}

describe('GoogleAuthGuard', () => {
  const parent = Object.getPrototypeOf(GoogleAuthGuard.prototype) as {
    canActivate: (context: ExecutionContext) => Promise<boolean>;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates signed random state containing the organization slug and sets a protected cookie', async () => {
    jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
    const guard = new GoogleAuthGuard(mkConfig());
    const { context, request, cookie } = httpContext('/auth/google', { organizationSlug: 'klass-42' });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    const state = request.googleOAuthState as string;
    const [payload, signature] = state.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    expect(decoded.organizationSlug).toBe('klass-42');
    expect(decoded.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(signature).toBeTruthy();
    expect(cookie).toHaveBeenCalledWith(
      'google_oauth_state',
      state,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(guard.getAuthenticateOptions(context)).toEqual({ state });
  });

  it('rejects a malformed organization slug before starting OAuth', async () => {
    const guard = new GoogleAuthGuard(mkConfig());
    const { context, cookie, redirect } = httpContext('/auth/google', { organizationSlug: 'Not A Slug' });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    expect(cookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(['', 'Klass', 'has space', 'under_score', '-leading', 'trailing-', 'double--hyphen', 'has.dot'])(
    'rejects invalid organization code %j before setting a cookie',
    async (slug) => {
      const guard = new GoogleAuthGuard(mkConfig());
      const { context, cookie } = httpContext('/auth/google', { organizationSlug: slug });

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
      expect(cookie).not.toHaveBeenCalled();
    },
  );

  it.each([
    { query: { code: 'code' }, cookie: undefined },
    { query: { error: 'access_denied', state: 'tampered' }, cookie: 'original-state' },
  ])('redirects a callback with absent or mismatched browser state to the SPA', async ({ query, cookie }) => {
    const guard = new GoogleAuthGuard(mkConfig({ FRONTEND_URL: 'https://localhost:4443/' }));
    const { context, redirect, clearCookie } = httpContext(
      '/auth/google/callback',
      query,
      cookie ? { cookie: `google_oauth_state=${cookie}` } : {},
    );

    await expect(guard.canActivate(context)).resolves.toBe(false);
    expect(redirect).toHaveBeenCalledWith(
      'https://localhost:4443/auth/callback#error=invalid_state',
    );
    expect(clearCookie).toHaveBeenCalledWith('google_oauth_state', expect.any(Object));
  });

  it('requires the matching state cookie before passing a callback to Passport', async () => {
    const start = httpContext('/auth/google', { organizationSlug: 'klass-42' });
    const guard = new GoogleAuthGuard(mkConfig());
    jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
    await guard.canActivate(start.context);
    const state = start.request.googleOAuthState as string;

    jest.spyOn(parent, 'canActivate').mockRejectedValue(new UnauthorizedException());
    const callback = httpContext('/auth/google/callback', { code: 'provider-code', state }, {
      cookie: `google_oauth_state=${state}`,
    });
    await expect(guard.canActivate(callback.context)).resolves.toBe(false);
    expect(callback.request.googleOrganizationSlug).toBe('klass-42');
    expect(callback.clearCookie).toHaveBeenCalledWith('google_oauth_state', expect.any(Object));
    expect(callback.redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback#error=oauth_failed');
  });

  it('does not accept state outside the callback browser cookie', async () => {
    jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
    const guard = new GoogleAuthGuard(mkConfig());
    const start = httpContext('/auth/google', { organizationSlug: 'klass-42' });
    await guard.canActivate(start.context);
    const state = start.request.googleOAuthState as string;
    const callback = httpContext('/auth/google/callback', { error: 'access_denied', state });

    await expect(guard.canActivate(callback.context)).resolves.toBe(false);
    expect(callback.redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback#error=invalid_state');
  });

  it('rejects a state whose signature was changed even when its cookie matches', async () => {
    const guard = new GoogleAuthGuard(mkConfig());
    const state = validState();
    const tampered = `${state.slice(0, -1)}${state.endsWith('a') ? 'b' : 'a'}`;
    const callback = httpContext('/auth/google/callback', { code: 'provider-code', state: tampered }, {
      cookie: `google_oauth_state=${tampered}`,
    });

    await expect(guard.canActivate(callback.context)).resolves.toBe(false);
    expect(callback.redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback#error=invalid_state');
  });

  it('rejects an expired state signed by the server', async () => {
    const guard = new GoogleAuthGuard(mkConfig());
    const state = validState({ expiresAt: Date.now() - 1 });
    const callback = httpContext('/auth/google/callback', { error: 'access_denied', state }, {
      cookie: `google_oauth_state=${state}`,
    });

    await expect(guard.canActivate(callback.context)).resolves.toBe(false);
    expect(callback.redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback#error=invalid_state');
  });

  it.each([
    { organizationSlug: 'Klass' },
    { nonce: 'short' },
    { expiresAt: 'later' },
  ])('rejects an invalid signed state payload %j', async (override) => {
    const guard = new GoogleAuthGuard(mkConfig());
    const state = validState(override);
    const callback = httpContext('/auth/google/callback', { code: 'provider-code', state }, {
      cookie: `google_oauth_state=${state}`,
    });

    await expect(guard.canActivate(callback.context)).resolves.toBe(false);
    expect(callback.redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback#error=invalid_state');
  });

  it('rejects a callback with valid state but no provider response', async () => {
    const guard = new GoogleAuthGuard(mkConfig());
    const state = validState();
    const callback = httpContext('/auth/google/callback', { state }, {
      cookie: `google_oauth_state=${state}`,
    });

    await expect(guard.canActivate(callback.context)).resolves.toBe(false);
    expect(callback.redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback#error=invalid_state');
  });

  it('rejects duplicate state parameters instead of choosing one', async () => {
    const guard = new GoogleAuthGuard(mkConfig());
    const state = validState();
    const callback = httpContext('/auth/google/callback', { state: [state, state] }, {
      cookie: `google_oauth_state=${state}`,
    });

    await expect(guard.canActivate(callback.context)).resolves.toBe(false);
    expect(callback.redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback#error=invalid_state');
  });

  it('generates a fresh state for every authorization start', async () => {
    const parentSpy = jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
    const guard = new GoogleAuthGuard(mkConfig());
    const first = httpContext('/auth/google', { organizationSlug: 'klass-42' });
    const second = httpContext('/auth/google', { organizationSlug: 'klass-42' });

    await guard.canActivate(first.context);
    await guard.canActivate(second.context);

    expect(first.request.googleOAuthState).not.toBe(second.request.googleOAuthState);
    expect(parentSpy).toHaveBeenCalledTimes(2);
  });

  it('does not redirect a failed OAuth start and uses the configured state secret', async () => {
    jest.spyOn(parent, 'canActivate').mockRejectedValue(new UnauthorizedException());
    const guard = new GoogleAuthGuard(mkConfig({ GOOGLE_OAUTH_STATE_SECRET: 'dedicated-secret' }));
    const { context, redirect, request, cookie } = httpContext('/auth/google', {
      organizationSlug: 'klass-42',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    const state = request.googleOAuthState as string;
    const encoded = state.split('.')[0];
    expect(state.split('.')[1]).toBe(
      crypto.createHmac('sha256', 'dedicated-secret').update(encoded).digest('base64url'),
    );
    expect(cookie).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
