#!/usr/bin/env node
/**
 * Build all extensions and publish as ZIPs to Vercel Blob + update DB.
 * Run from repo root: node scripts/publish-extensions.mjs [--skip-build] [filter]
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { createRequire } from 'module';

const ROOT = resolve(import.meta.dirname, '..');
const EXT_DIR = join(ROOT, 'packages', 'extensions');
const WEB_DIR = join(ROOT, 'apps', 'web');
const FILTER = process.argv.slice(2).find((a) => a !== '--skip-build');
const SKIP_BUILD = process.argv.includes('--skip-build');

// Load .env
const envPath = join(WEB_DIR, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=["']?(.+?)["']?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
if (!BLOB_TOKEN || !DATABASE_URL) {
  console.error('Missing BLOB_READ_WRITE_TOKEN or DATABASE_URL');
  process.exit(1);
}

// Require from apps/web context (has jszip, @prisma/client)
const req = createRequire(join(WEB_DIR, 'package.json'));
const JSZip = req('jszip');
const { PrismaClient } = req('@prisma/client');

if (!SKIP_BUILD) {
  console.log('\n🔨 Building...\n');
  execSync('node scripts/build-extensions.mjs' + (FILTER ? ` ${FILTER}` : ''), {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

console.log('\n📦 Uploading...\n');

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
let ok = 0,
  fail = 0;

for (const dir of readdirSync(EXT_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)) {
  const pkgPath = join(EXT_DIR, dir, 'package.json');
  const distPath = join(EXT_DIR, dir, 'dist', 'index.js');
  if (!existsSync(pkgPath) || !existsSync(distPath)) continue;
  if (FILTER && !dir.includes(FILTER)) continue;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const manifest = pkg.xplorer;
  if (!manifest?.id) continue;

  const version = manifest.version || '1.0.0';
  const slug = manifest.id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  try {
    const zip = new JSZip();
    zip.file('package.json', readFileSync(pkgPath));
    zip.file('dist/index.js', readFileSync(distPath));
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    const checksum = createHash('sha256').update(zipBuf).digest('hex');
    const blobPath = `extensions/${manifest.id}/${version}/${slug}.zip`;

    const res = await fetch(`https://blob.vercel-storage.com/${blobPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${BLOB_TOKEN}`,
        'x-content-type': 'application/zip',
        'x-add-random-suffix': 'true',
      },
      body: zipBuf,
    });
    if (!res.ok) {
      console.error(`  ✗ ${manifest.id}: ${(await res.text()).slice(0, 60)}`);
      fail++;
      continue;
    }
    const blob = await res.json();

    const ext = await prisma.extension.findUnique({ where: { slug } });
    if (ext) {
      await prisma.extension.update({
        where: { slug },
        data: {
          version,
          downloadUrl: blob.url,
          fileSize: zipBuf.length,
          checksum,
          status: 'APPROVED',
          isPublished: true,
        },
      });
      await prisma.extensionVersion.updateMany({
        where: { extensionId: ext.id },
        data: { isLatest: false },
      });
      await prisma.extensionVersion.upsert({
        where: { extensionId_version: { extensionId: ext.id, version } },
        update: {
          downloadUrl: blob.url,
          blobUrl: blob.url,
          checksum,
          fileSize: zipBuf.length,
          isLatest: true,
        },
        create: {
          extensionId: ext.id,
          version,
          downloadUrl: blob.url,
          blobUrl: blob.url,
          checksum,
          fileSize: zipBuf.length,
          isLatest: true,
          changeLog: 'Published.',
        },
      });
    }
    console.log(`  ✓ ${manifest.id} (${(zipBuf.length / 1024).toFixed(1)}KB)`);
    ok++;
  } catch (err) {
    console.error(`  ✗ ${manifest.id}: ${err.message}`);
    fail++;
  }
}

await prisma.$disconnect();
console.log(`\n✅ Done. ${ok} published, ${fail} failed.\n`);
