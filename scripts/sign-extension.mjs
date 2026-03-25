#!/usr/bin/env node
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const extensionDir = process.argv[2];
if (!extensionDir) {
  console.error('Usage: node scripts/sign-extension.mjs <extension-dir>');
  process.exit(1);
}

const distPath = join(extensionDir, 'dist', 'index.js');
const pkgPath = join(extensionDir, 'package.json');

try {
  const bundle = readFileSync(distPath, 'utf-8');
  const hash = createHash('sha256').update(bundle).digest('hex');

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  if (!pkg.xplorer) pkg.xplorer = {};
  pkg.xplorer.checksum = hash;

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`[sign] ${pkg.xplorer.id || pkg.name}: checksum = ${hash}`);
} catch (err) {
  console.error(`Failed to sign extension: ${err.message}`);
  process.exit(1);
}
