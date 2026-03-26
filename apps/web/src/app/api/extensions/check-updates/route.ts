import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { corsHeaders, handleCors } from '@/lib/cors';
import { checkUpdatesSchema } from '@/lib/validation';

/**
 * Compare two semver version strings.
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 * Falls back to string comparison if parsing fails.
 */
function compareSemver(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const parts = v.replace(/^v/, '').split('-');
    const numbers = parts[0].split('.').map(Number);
    return {
      major: numbers[0] || 0,
      minor: numbers[1] || 0,
      patch: numbers[2] || 0,
      prerelease: parts[1] || '',
    };
  };

  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
  if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
  if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;

  // Prerelease versions have lower precedence than release
  if (va.prerelease && !vb.prerelease) return -1;
  if (!va.prerelease && vb.prerelease) return 1;
  if (va.prerelease && vb.prerelease) {
    return va.prerelease < vb.prerelease ? -1 : va.prerelease > vb.prerelease ? 1 : 0;
  }

  return 0;
}

/**
 * POST /api/extensions/check-updates — Check for extension updates
 *
 * Body: { extensions: [{ id: string, version: string }] }
 * Returns: { updates: [{ id, name, displayName, latestVersion, currentVersion,
 *                         downloadUrl, fileSize, checksum, changelog }] }
 *
 * Matches extensions by database ID or by name (for locally-installed extensions
 * whose manifest ID may match the extension name rather than the DB cuid).
 */
export async function POST(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const body = await request.json();
    const parsed = checkUpdatesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const { extensions } = parsed.data;

    if (extensions.length === 0) {
      return NextResponse.json({ updates: [] }, { headers: corsHeaders(request) });
    }

    const extensionIds = extensions.map((e) => e.id);

    // Query by both id and name to support locally-installed extensions
    // whose manifest id may be a slug (e.g. "my-extension") rather than
    // the database cuid.
    const dbExtensions = await prisma.extension.findMany({
      where: {
        OR: [
          { id: { in: extensionIds } },
          { name: { in: extensionIds } },
          { slug: { in: extensionIds } },
        ],
        isPublished: true,
        status: 'APPROVED',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        displayName: true,
        version: true,
        downloadUrl: true,
        fileSize: true,
        checksum: true,
        versions: {
          where: { isLatest: true },
          select: {
            version: true,
            changeLog: true,
            downloadUrl: true,
            fileSize: true,
            checksum: true,
          },
          take: 1,
        },
      },
    });

    const updates = dbExtensions
      .map((dbExt) => {
        // Match by id, name, or slug
        const clientExt = extensions.find(
          (e) => e.id === dbExt.id || e.id === dbExt.name || e.id === dbExt.slug
        );
        if (!clientExt) return null;

        // Use the latest version record if available, otherwise fall back to
        // the extension-level version field.
        const latestVersionRecord = dbExt.versions[0];
        const latestVersion = latestVersionRecord?.version || dbExt.version;

        // Only report an update if the marketplace version is newer
        if (compareSemver(latestVersion, clientExt.version) <= 0) return null;

        return {
          id: clientExt.id, // Return the ID the client sent so it can match
          name: dbExt.name,
          displayName: dbExt.displayName,
          latestVersion,
          currentVersion: clientExt.version,
          downloadUrl: latestVersionRecord?.downloadUrl || dbExt.downloadUrl,
          fileSize: latestVersionRecord?.fileSize || dbExt.fileSize,
          checksum: latestVersionRecord?.checksum || dbExt.checksum,
          changelog: latestVersionRecord?.changeLog || null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ updates }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('POST /api/extensions/check-updates error:', error);
    return NextResponse.json(
      { error: 'Failed to check updates' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
