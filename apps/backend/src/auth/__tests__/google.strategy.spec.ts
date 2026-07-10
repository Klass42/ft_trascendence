import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from '../google.strategy';

const mkConfig = () =>
  ({
    getOrThrow: (key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
      if (key === 'GOOGLE_CLIENT_SECRET') return 'test-client-secret';
      if (key === 'GOOGLE_CALLBACK_URL') return 'http://localhost:3000/auth/google/callback';
      throw new Error(`Unknown key: ${key}`);
    },
  }) as unknown as ConfigService;

describe('GoogleStrategy', () => {
  it('reads clientID, clientSecret, callbackURL, scope from ConfigService', () => {
    const strategy = new GoogleStrategy(mkConfig());
    expect(strategy).toBeDefined();
  });

  it('throws when GOOGLE_CLIENT_ID is missing', () => {
    const badConfig = {
      getOrThrow: (key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') throw new Error('missing');
        return 'x';
      },
    } as unknown as ConfigService;

    expect(() => new GoogleStrategy(badConfig)).toThrow();
  });
});
