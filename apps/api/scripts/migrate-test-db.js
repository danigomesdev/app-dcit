#!/usr/bin/env node
'use strict';

/**
 * Applies Prisma migrations to apps/api's isolated SQLite test database
 * (prisma/test.db) before Jest runs, so the test suite works on a
 * completely clean checkout (fresh `git clone`, fresh CI runner) where
 * prisma/test.db does not exist yet and has no tables.
 *
 * This intentionally does NOT touch apps/api/.env or apps/api/prisma/dev.db
 * — the real database used by `start:dev` and manual curl-testing. The
 * DATABASE_URL override below is applied only to this one child process's
 * environment, so `.env` (which points at dev.db) is never read or written.
 *
 * `prisma migrate deploy` is idempotent: it creates the SQLite file if
 * missing, applies any migrations not yet recorded in it, and does nothing
 * (safely) if the database is already up to date. Safe to run before every
 * test run.
 *
 * Invoked directly via node (not through a package-manager-specific
 * pretest hook or `VAR=x cmd` shell syntax) so it behaves identically in
 * git-bash locally and in the PowerShell-flavored windows-latest CI runner
 * — matching this package's existing `node ./node_modules/jest/bin/jest.js`
 * pattern for avoiding shell/shim differences.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const apiRoot = path.join(__dirname, '..');
const prismaCli = path.join(apiRoot, 'node_modules', 'prisma', 'build', 'index.js');

const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: apiRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: 'file:./test.db',
  },
});

if (result.error) {
  console.error('[migrate-test-db] failed to spawn prisma CLI:', result.error);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
