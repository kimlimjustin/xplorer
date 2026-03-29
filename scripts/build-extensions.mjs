#!/usr/bin/env node
/**
 * Build all extensions in packages/extensions/.
 *
 * Usage:
 *   node scripts/build-extensions.mjs           # build all once
 *   node scripts/build-extensions.mjs --watch   # watch mode with hot reload
 *   node scripts/build-extensions.mjs ssh        # build a single extension
 */

import { readdirSync, existsSync, readFileSync, mkdirSync, cpSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import * as esbuild from 'esbuild';

const ROOT = resolve(import.meta.dirname, '..');
const EXT_DIR = join(ROOT, 'packages', 'extensions');
const WATCH = process.argv.includes('--watch');
const FILTER = process.argv.slice(2).find((a) => a !== '--watch');

const EXTERNAL = ['react', 'react-dom', '@xplorer/extension-sdk'];

// Find the Tauri data/extensions dir for hot reload copy
const DATA_EXT_DIR = join(ROOT, 'apps', 'src-tauri', 'data', 'extensions');

const getExtensionDirs = () => {
  const dirs = readdirSync(EXT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (FILTER) {
    const match = dirs.filter((d) => d.includes(FILTER));
    if (match.length === 0) {
      console.error(`No extension matching "${FILTER}" found.`);
      process.exit(1);
    }
    return match;
  }
  return dirs;
};

const getManifestId = (dir) => {
  const pkgPath = join(EXT_DIR, dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.xplorer?.id || null;
  } catch {
    return null;
  }
};

const installDepsIfNeeded = (dir) => {
  const pkgPath = join(EXT_DIR, dir, 'package.json');
  const nmPath = join(EXT_DIR, dir, 'node_modules');
  if (!existsSync(pkgPath)) return;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const hasDeps = pkg.dependencies && Object.keys(pkg.dependencies).length > 0;

  if (hasDeps && !existsSync(nmPath)) {
    console.log(`  [install] ${dir}: installing dependencies...`);
    execSync('pnpm install --no-frozen-lockfile', {
      cwd: join(EXT_DIR, dir),
      stdio: 'pipe',
    });
  }
};

const buildExtension = async (dir) => {
  const entryPoint = join(EXT_DIR, dir, 'src', 'index.tsx');
  if (!existsSync(entryPoint)) return null;

  const outfile = join(EXT_DIR, dir, 'dist', 'index.js');
  mkdirSync(join(EXT_DIR, dir, 'dist'), { recursive: true });

  installDepsIfNeeded(dir);

  const opts = {
    entryPoints: [entryPoint],
    bundle: true,
    format: 'iife',
    outfile,
    external: EXTERNAL,
    target: 'es2020',
    jsx: 'transform',
    logLevel: 'warning',
  };

  if (WATCH) {
    const manifestId = getManifestId(dir);
    const ctx = await esbuild.context({
      ...opts,
      plugins: [
        {
          name: 'hot-reload-copy',
          setup(build) {
            build.onEnd((result) => {
              if (result.errors.length === 0 && manifestId) {
                const target = join(DATA_EXT_DIR, manifestId);
                if (existsSync(target)) {
                  try {
                    const srcDist = join(EXT_DIR, dir, 'dist', 'index.js');
                    const dstDist = join(target, 'dist', 'index.js');
                    mkdirSync(join(target, 'dist'), { recursive: true });
                    cpSync(srcDist, dstDist);
                    console.log(`  [hot] ${dir} → ${manifestId}/dist/index.js`);
                  } catch {
                    /* ignore copy errors */
                  }
                }
              }
            });
          },
        },
      ],
    });
    await ctx.watch();
    return ctx;
  }

  await esbuild.build(opts);
  return null;
};

// ── Main ─────────────────────────────────────────────────────────────────────

const dirs = getExtensionDirs();
console.log(`\n${WATCH ? '👀 Watching' : '🔨 Building'} ${dirs.length} extensions...\n`);

let built = 0;
let failed = 0;
const contexts = [];

for (const dir of dirs) {
  const entry = join(EXT_DIR, dir, 'src', 'index.tsx');
  if (!existsSync(entry)) {
    continue;
  }

  try {
    const ctx = await buildExtension(dir);
    if (ctx) contexts.push(ctx);
    built++;
    if (!WATCH) console.log(`  ✓ ${dir}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${dir}: ${err.message?.split('\n')[0] || err}`);
  }
}

console.log(`\n${WATCH ? 'Watching' : 'Done'}. Built: ${built}, Failed: ${failed}\n`);

if (WATCH) {
  console.log('Press Ctrl+C to stop.\n');
  process.on('SIGINT', async () => {
    for (const ctx of contexts) {
      await ctx.dispose();
    }
    process.exit(0);
  });
}
