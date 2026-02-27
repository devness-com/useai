/**
 * Global Vitest setup — data isolation safety net.
 *
 * Verifies that USEAI_HOME is set to a temp directory (via vitest.config.ts env)
 * so that even if a test forgets to mock path constants, real user data is safe.
 */
import { beforeAll } from 'vitest';
import { homedir } from 'node:os';

beforeAll(() => {
  const useaiHome = process.env['USEAI_HOME'];
  const realHome = homedir();
  const dangerousPath = `${realHome}/.useai`;

  if (!useaiHome || useaiHome === dangerousPath || useaiHome.startsWith(realHome)) {
    throw new Error(
      `TEST ISOLATION VIOLATION: USEAI_HOME is not set to a safe temp directory.\n` +
        `Current value: ${useaiHome ?? '(not set)'}\n` +
        `Set env.USEAI_HOME in vitest.config.ts to prevent tests from touching real data.`,
    );
  }
});
