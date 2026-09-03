import type { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  // HTTP/WebSocket integration suites need a bindable local port, which is not
  // available in every development sandbox. They run through test:integration.
  testRegex: 'src/(?!.*(?:\\.e2e|realtime\\.gateway)\\.spec\\.ts$).*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  testTimeout: 10000,
} satisfies Config;
