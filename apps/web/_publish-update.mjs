import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
const data = JSON.parse(
  readFileSync('/Users/kimlim/Projects/xplorer/.orchestrate/_publish-data.json', 'utf-8'),
);
const prisma = new PrismaClient();
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
      await prisma.extensionVersion.upsert({
        where: { extensionId_version: { extensionId: existing.id, version: ext.version } },
        update: {
          downloadUrl: ext.downloadUrl,
          blobUrl: ext.blobUrl,
          checksum: ext.checksum,
          fileSize: ext.fileSize,
          isLatest: true,
        },
        create: {
          extensionId: existing.id,
          version: ext.version,
          downloadUrl: ext.downloadUrl,
          blobUrl: ext.blobUrl,
          checksum: ext.checksum,
          fileSize: ext.fileSize,
          isLatest: true,
          changeLog: 'Published.',
        },
      });
      console.log('  [updated] ' + ext.id);
    } else {
      console.log('  [skip] ' + ext.id + ' (not in DB)');
    }
  } catch (err) {
    console.error('  [error] ' + ext.id + ':', err.message);
  }
}
await prisma.$disconnect();
