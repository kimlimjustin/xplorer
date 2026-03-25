/**
 * Creates a symlink for .prisma/client in node_modules.
 * Needed because pnpm + preserveSymlinks:true can't resolve
 * the generated Prisma client without it.
 */
import { existsSync, mkdirSync, symlinkSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const nodeModules = resolve(import.meta.dirname, '..', 'node_modules');
const target = join(nodeModules, '.prisma', 'client');

if (existsSync(target)) {
  // Already exists (e.g. pnpm created it), nothing to do
  process.exit(0);
}

// Find the generated client in pnpm store
const prismaClientPkg = join(nodeModules, '@prisma', 'client', 'package.json');
if (!existsSync(prismaClientPkg)) {
  console.warn('[link-prisma] @prisma/client not installed, skipping');
  process.exit(0);
}

// Walk up from @prisma/client's real location to find .prisma/client
import { readlinkSync } from 'fs';

let clientDir;
try {
  clientDir = readlinkSync(join(nodeModules, '@prisma', 'client'));
} catch {
  // Not a symlink (non-pnpm), .prisma should already be accessible
  process.exit(0);
}

// Resolve the symlink — clientDir may be absolute or relative
const resolvedClientDir = resolve(join(nodeModules, '@prisma', 'client'), '..', clientDir);
// .prisma/client lives under the same node_modules as @prisma/client
const storeNodeModules = resolve(resolvedClientDir, '..', '..');
const storePrismaClient = join(storeNodeModules, '.prisma', 'client');

if (!existsSync(storePrismaClient)) {
  console.warn('[link-prisma] .prisma/client not found in pnpm store at', storePrismaClient);
  process.exit(0);
}

mkdirSync(join(nodeModules, '.prisma'), { recursive: true });
symlinkSync(storePrismaClient, target, 'junction');
console.log('[link-prisma] Linked .prisma/client');
