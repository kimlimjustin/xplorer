import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { extensionIcons } from './extension-icons';

const prisma = new PrismaClient();
const RESET = process.argv.includes('--reset');

// ── Category definitions ────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Themes', slug: 'themes', description: 'Visual themes and color schemes for Xplorer', icon: 'palette' },
  { name: 'Previews', slug: 'previews', description: 'File preview extensions for various formats', icon: 'eye' },
  { name: 'Productivity', slug: 'productivity', description: 'Extensions to boost your productivity', icon: 'zap' },
  { name: 'Developer Tools', slug: 'developer-tools', description: 'Tools and utilities for developers', icon: 'wrench' },
  { name: 'Cloud Storage', slug: 'cloud-storage', description: 'Cloud storage integrations and connectors', icon: 'cloud' },
  { name: 'Security', slug: 'security', description: 'Security and privacy extensions', icon: 'shield' },
  { name: 'Media', slug: 'media', description: 'Media playback and editing extensions', icon: 'film' },
  { name: 'Utilities', slug: 'utilities', description: 'General-purpose utility extensions', icon: 'settings' },
];

// Map extension manifest category → marketplace category slug
const CATEGORY_MAP: Record<string, string> = {
  'panel': 'productivity',
  'theme': 'themes',
  'preview': 'previews',
  'action': 'utilities',
  'tool': 'utilities',
  'editor': 'developer-tools',
  'bottom-tab': 'developer-tools',
  'remote': 'cloud-storage',
  'tab': 'cloud-storage',
  'navigation': 'cloud-storage',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ExtensionManifest {
  id: string;
  name?: string;
  displayName?: string;
  description: string;
  version: string;
  author?: string;
  category: string;
  icon?: string;
  keywords?: string[];
  permissions?: string[];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readExtensionManifests(): { dirName: string; manifest: ExtensionManifest }[] {
  const results: { dirName: string; manifest: ExtensionManifest }[] = [];

  // Scan both public and private extension directories
  const extensionDirs = [
    path.resolve(__dirname, '../../../packages/extensions'),
    path.resolve(__dirname, '../../extensions'),
  ];

  for (const examplesDir of extensionDirs) {
    if (!fs.existsSync(examplesDir)) {
      continue;
    }

    const dirs = fs.readdirSync(examplesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of dirs) {
      const pkgPath = path.join(examplesDir, dir, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const manifest = pkg.xplorer as ExtensionManifest | undefined;
        if (!manifest || !manifest.id || !manifest.description) continue;
        results.push({ dirName: dir, manifest });
      } catch (err) {
        console.warn(`[seed] Failed to read ${pkgPath}:`, err);
      }
    }
  }

  return results;
}

// ── Main seed ───────────────────────────────────────────────────────────────

async function main() {
  console.log('[seed] Starting database seed...\n');

  // 0. Reset if --reset flag is passed
  if (RESET) {
    console.log('[seed] --reset flag detected. Clearing existing extension data...');
    await prisma.extensionVersion.deleteMany({});
    await prisma.download.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.trial.deleteMany({});
    await prisma.categoriesOnExtensions.deleteMany({});
    await prisma.tagsOnExtensions.deleteMany({});
    await prisma.extension.deleteMany({});
    await prisma.tag.deleteMany({});
    console.log('[seed] Cleared all extension data.\n');
  }

  // 1. Upsert categories
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, icon: cat.icon },
      create: cat,
    });
  }
  console.log(`[seed] Upserted ${CATEGORIES.length} categories.`);

  // 2. Upsert system user (Xplorer Team)
  // Try by email first, then by username
  let systemUser = await prisma.user.findUnique({ where: { email: 'team@xplorer.app' } });
  if (!systemUser) {
    systemUser = await prisma.user.findUnique({ where: { username: 'xplorer-team' } });
  }
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: 'team@xplorer.app',
        name: 'Xplorer Team',
        username: 'xplorer-team',
        role: 'ADMIN',
      },
    });
  } else {
    systemUser = await prisma.user.update({
      where: { id: systemUser.id },
      data: { name: 'Xplorer Team', role: 'ADMIN' },
    });
  }
  console.log(`[seed] System user: ${systemUser.name} (${systemUser.id})`);

  // 3. Read all extension manifests from examples/
  const extensions = readExtensionManifests();
  console.log(`[seed] Found ${extensions.length} extensions in examples/.\n`);

  let created = 0;
  let updated = 0;

  for (const { dirName, manifest } of extensions) {
    const slug = slugify(manifest.id);
    const displayName = manifest.displayName || manifest.name || manifest.id;
    const categorySlug = CATEGORY_MAP[manifest.category] || 'utilities';
    const svgIcon = extensionIcons[manifest.id] || null;

    // Look up the category
    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });

    try {
      const existing = await prisma.extension.findUnique({ where: { slug } });

      if (existing) {
        // Update existing
        await prisma.extension.update({
          where: { slug },
          data: {
            displayName,
            description: manifest.description,
            version: manifest.version || '1.0.0',
            icon: svgIcon || manifest.icon || null,
            status: 'APPROVED',
            isPublished: true,
            publishedAt: existing.publishedAt || new Date(),
          },
        });
        updated++;
      } else {
        // Create new
        const ext = await prisma.extension.create({
          data: {
            name: manifest.id,
            slug,
            displayName,
            description: manifest.description,
            longDescription: manifest.keywords
              ? `**Keywords:** ${manifest.keywords.join(', ')}\n\n**Permissions:** ${(manifest.permissions || []).join(', ')}`
              : `**Permissions:** ${(manifest.permissions || []).join(', ')}`,
            version: manifest.version || '1.0.0',
            icon: svgIcon || manifest.icon || null,
            status: 'APPROVED',
            isPublished: true,
            isFeatured: ['ai-chat', 'code-editor', 'xplorer-dracula-theme', 'duplicate-finder', 'git'].includes(manifest.id),
            publishedAt: new Date(),
            authorId: systemUser.id,
            categories: category
              ? { create: [{ category: { connect: { id: category.id } } }] }
              : undefined,
            tags: manifest.keywords
              ? {
                  create: manifest.keywords.slice(0, 5).map(kw => ({
                    tag: {
                      connectOrCreate: {
                        where: { name: kw },
                        create: { name: kw, slug: slugify(kw) },
                      },
                    },
                  })),
                }
              : undefined,
          },
        });

        // Create initial version
        await prisma.extensionVersion.create({
          data: {
            version: manifest.version || '1.0.0',
            extensionId: ext.id,
            downloadUrl: `local://examples/${dirName}/dist/index.js`,
            isLatest: true,
            changeLog: 'Initial release.',
          },
        });

        created++;
      }

      console.log(`  [${existing ? 'updated' : 'created'}] ${displayName} (${slug}) → ${categorySlug}`);
    } catch (err) {
      console.error(`  [error] ${displayName} (${slug}):`, err);
    }
  }

  console.log(`\n[seed] Done. Created: ${created}, Updated: ${updated}, Total: ${extensions.length}`);
}

main()
  .catch((e) => {
    console.error('[seed] Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
