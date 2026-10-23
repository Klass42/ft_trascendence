import { applyDecorators, Injectable, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  SkipThrottle,
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

const windowEnv = 'AUTH_RATE_LIMIT_WINDOW_MS';
const defaultWindow = 60_000;

const policies = {
  loginIp: { name: 'auth-login-ip', env: 'AUTH_RATE_LIMIT_LOGIN_IP', limit: 30 },
  loginEmail: { name: 'auth-login-email', env: 'AUTH_RATE_LIMIT_LOGIN_EMAIL', limit: 10 },
  register: { name: 'auth-register', env: 'AUTH_RATE_LIMIT_REGISTER', limit: 5 },
  refresh: { name: 'auth-refresh', env: 'AUTH_RATE_LIMIT_REFRESH', limit: 30 },
  platformLogin: { name: 'auth-platform-login', env: 'AUTH_RATE_LIMIT_PLATFORM_LOGIN', limit: 10 },
  verifyEmail: { name: 'auth-verify-email', env: 'AUTH_RATE_LIMIT_VERIFY_EMAIL', limit: 10 },
  acceptInvitation: { name: 'auth-accept-invitation', env: 'AUTH_RATE_LIMIT_ACCEPT_INVITATION', limit: 10 },
} as const;

export type AuthRateLimitRoute =
  | 'login'
  | Exclude<keyof typeof policies, 'loginIp' | 'loginEmail'>;

function envLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function requestEmailTracker(request: Record<string, any>): string {
  const email = request.body?.email;
  return typeof email === 'string' && email.trim()
    ? `email:${email.trim().toLowerCase()}`
    : 'email:missing';
}

@Injectable()
class AuthThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storage, reflector);
  }

  protected setResponseHeader(res: Record<string, any>, name: string, value: string | number): void {
    if (name.startsWith('Retry-After-')) {
      super.setResponseHeader(res, 'Retry-After', value);
    }
    super.setResponseHeader(res, name, value);
  }
}

/**
 * Auth limits can be tuned with AUTH_RATE_LIMIT_WINDOW_MS (default 60000),
 * AUTH_RATE_LIMIT_LOGIN_IP (30, generous because a campus or classroom can
 * share one address) / AUTH_RATE_LIMIT_LOGIN_EMAIL (10, per account),
 * AUTH_RATE_LIMIT_REGISTER (5), AUTH_RATE_LIMIT_REFRESH (30),
 * AUTH_RATE_LIMIT_PLATFORM_LOGIN (10), AUTH_RATE_LIMIT_VERIFY_EMAIL (10), and
 * AUTH_RATE_LIMIT_ACCEPT_INVITATION (10). Values are requests per window.
 */
export function AuthRateLimit(route: AuthRateLimitRoute) {
  const active = route === 'login' ? [policies.loginIp, policies.loginEmail] : [policies[route]];
  const activeNames = new Set(active.map((policy) => policy.name));
  const throttleOptions = Object.fromEntries(
    active.map((policy) => [
      policy.name,
      {
        limit: () => envLimit(policy.env, policy.limit),
        ttl: () => envLimit(windowEnv, defaultWindow),
        ...(policy === policies.loginEmail ? { getTracker: requestEmailTracker } : {}),
      },
    ]),
  );
  const skippedOptions = Object.fromEntries(
    Object.values(policies).map((policy) => [policy.name, !activeNames.has(policy.name)]),
  );

  return applyDecorators(
    UseGuards(AuthThrottlerGuard),
    SkipThrottle(skippedOptions),
    Throttle(throttleOptions),
  );
}

export const AuthThrottlerModule = ThrottlerModule.forRoot({
  skipIf: () => process.env.NODE_ENV === 'test',
  throttlers: Object.values(policies).map(({ name, limit }) => ({
    name,
    limit,
    ttl: defaultWindow,
  })),
});
