import { execFileSync } from 'node:child_process';

import { assertTestDatabase } from './src/testing/test-database.js';
import { E2E_DATABASE_URL } from './vitest.e2e.env.js';

/**
 * Runs once for the whole end-to-end run, before any suite boots. Applying the
 * migrations here rather than inside a suite keeps the promise a clean machine
 * needs: start the containers, run one command.
 */
export function setup(): void {
  assertTestDatabase(E2E_DATABASE_URL);

  // The Prisma configuration reads the variable from the environment, and
  // dotenv leaves an already-set value alone, so this one wins over any file.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit',
  });
}
