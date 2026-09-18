import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Every variable the environment schema requires. Suites pass that same
    // schema to the configuration module, so a value reaches them converted
    // exactly as it reaches the running application: the token lifetime as a
    // number, the allowed origins as a list.
    //
    // The hosts are deliberately unroutable. A suite that forgets to replace an
    // outside dependency then fails instead of quietly reaching the one running
    // on this machine.
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgresql://test:test@postgres.invalid:5432/test',
      REDIS_URL: 'redis://redis.invalid:6379/0',
      JWT_SECRET: 'test-secret-xxxxxxxxxxxxxxxxxxxxxx',
      JWT_TTL_SECONDS: '3600',
      CORS_ORIGIN: 'http://localhost:4100',
      S3_ENDPOINT: 'http://storage.invalid:9000',
      S3_BUCKET: 'bucket',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
      S3_REGION: 'us-east-1',
    },
  },
});
