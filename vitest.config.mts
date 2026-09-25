import { defineConfig } from 'vitest/config';

// Integration values match docker-compose.test.yml. Assigned here too so globalSetup sees it.
const env = {
  NODE_ENV: 'test',
  // Keep tests hermetic: never read the developer's real .env.
  DOTENV_CONFIG_PATH: 'tests/fixtures/none.env',
  DOTENV_CONFIG_QUIET: 'true',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123',
  POSTGRES_URL: 'postgres://postgres:test@127.0.0.1:55432/ghoul_test',
  REDIS_URL: 'redis://127.0.0.1:56379',
  EMAIL_TRANSPORT: 'log',
  QUESTIONS_PATH: 'tests/fixtures/questions.json',
};
Object.assign(process.env, env);

export default defineConfig({
  test: {
    env,
    testTimeout: 15000,
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/globalSetup.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
