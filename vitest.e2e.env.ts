/**
 * The environment the end-to-end run boots under. Written here rather than in
 * the config, because the global setup needs the same database URL to run the
 * migrations, so neither file is the one holding it twice.
 *
 * These are the development defaults from the compose file, not secrets. A
 * dotenv file would be the other option, but every one of them is gitignored,
 * so a fresh checkout would fail until someone wrote it by hand.
 */

// The port belongs to the second database service, not the development one.
export const E2E_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/nestjs_tutorial_test?schema=public';

export const e2eEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: E2E_DATABASE_URL,
  // A database index of its own on the shared server, so a stale key left by
  // the development session cannot reach a request under test.
  REDIS_URL: 'redis://localhost:6379/1',
  JWT_SECRET: 'e2e-secret-xxxxxxxxxxxxxxxxxxxxxx',
  JWT_TTL_SECONDS: '3600',
  CORS_ORIGIN: 'http://localhost:4100',
  // Object storage is never reached by a comment request, so the host stays
  // unroutable: a suite that grows into it fails instead of writing objects.
  S3_ENDPOINT: 'http://storage.invalid:9000',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
  S3_REGION: 'us-east-1',
};
