
const { PrismaClient } = require('@prisma/client');
const data = require('/Users/kimlim/Projects/xplorer/.orchestrate/_publish-data.json');
const prisma = new PrismaClient();

async function main() {
  for (const ext of data) {
    try {
      const existing = await prisma.extension.findUnique({ where: { slug: ext.slug } });
      if (existing) {
        await prisma.extension.update({
          where: { slug: ext.slug },
          data: {
            version: ext.version,
            downloadUrl: ext.downloadUrl,
            checksum: ext.checksum,
            fileSize: ext.fileSize,
            status: 'APPROVED',
            isPublished: true,
          },
        });
        // Upsert latest version
        await prisma.extensionVersion.upsert({
          where: { extensionId_version: { extensionId: existing.id, version: ext.version } },
          update: { downloadUrl: ext.downloadUrl, blobUrl: ext.blobUrl, checksum: ext.checksum, fileSize: ext.fileSize, isLatest: true },
          create: { extensionId: existing.id, version: ext.version, downloadUrl: ext.downloadUrl, blobUrl: ext.blobUrl, checksum: ext.checksum, fileSize: ext.fileSize, isLatest: true, changeLog: 'Published via publish-extensions script.' },
        });
        console.log('  [updated] ' + ext.id);
      } else {
        console.log('  [skip] ' + ext.id + ' — not in database (run db:reseed first)');
      }
    } catch (err) {
      console.error('  [error] ' + ext.id + ':', err.message);
    }
  }
}

main().finally(() => prisma.$disconnect());
