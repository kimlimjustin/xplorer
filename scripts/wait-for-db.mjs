#!/usr/bin/env node
/**
 * Wait for PostgreSQL to be ready before proceeding.
 * Used by `pnpm run db:up` to ensure the database is accepting connections.
 */
import { execSync } from 'child_process';

const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 1000;

for (let i = 0; i < MAX_RETRIES; i++) {
  try {
    execSync('docker compose exec postgres pg_isready -U xplorer', { stdio: 'ignore' });
    console.log('[db] PostgreSQL is ready.');
    process.exit(0);
  } catch {
    if (i === 0) process.stdout.write('[db] Waiting for PostgreSQL');
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, RETRY_INTERVAL_MS));
  }
}

console.error('\n[db] PostgreSQL did not become ready in time.');
process.exit(1);
