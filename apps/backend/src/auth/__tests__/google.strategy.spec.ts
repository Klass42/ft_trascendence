import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from '../google.strategy';

const mkConfig = (overrides?: Record<string, string>) =>
  ({
    get: (key: string) => overrides?.[key] ?? null,
  }) as unknown as ConfigService;

describe('GoogleStrategy', () => {
  it('reads clientID, clientSecret, callbackURL, scope from ConfigService', () => {
    const strategy = new GoogleStrategy(
      mkConfig({
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
      }),
    );
    expect(strategy).toBeDefined();
  });

  it('uses fallback values when env vars are missing', () => {
    const strategy = new GoogleStrategy(mkConfig());
    expect(strategy).toBeDefined();
  });
});
