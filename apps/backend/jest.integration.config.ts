import type { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  // These are genuine network integration tests. Keep them separate from the
  // unit suite so an environment that forbids socket binding can still run the
  // deterministic checks; CI/containers run this config on a normal host.
  testRegex: 'src.*(?:\\.e2e|realtime\\.gateway)\\.spec\\.ts$',
  testTimeout: 15000,
} satisfies Config;
