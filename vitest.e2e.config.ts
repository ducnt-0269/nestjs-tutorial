import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

import { e2eEnv } from './vitest.e2e.env.js';

// A second config rather than a second glob in the first one: the unit run
// points every outside dependency at an unroutable host on purpose, so a suite
// that forgets a stub fails loudly. This run needs the opposite.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./vitest.e2e.setup.ts'],
    env: e2eEnv,
    // Every suite shares one database and empties it between tests, so two
    // files running at once would clear each other's rows mid-request.
    fileParallelism: false,
    // Booting the application and reaching a real database costs more than a
    // stubbed call, and registration hashes a password on the way.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
