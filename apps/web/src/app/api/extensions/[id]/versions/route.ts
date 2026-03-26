import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { uploadExtensionFile, computeChecksum } from '@/lib/upload';
import { versionSchema } from '@/lib/validation';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/extensions/[id]/versions — List versions for an extension
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const { id } = await context.params;

    const extension = await prisma.extension.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    // MED-32: Pagination support
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Math.min(10000, parseInt(searchParams.get('page') || '1', 10) || 1));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const [versions, total] = await Promise.all([
      prisma.extensionVersion.findMany({
        where: { extensionId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.extensionVersion.count({ where: { extensionId: id } }),
    ]);

    return NextResponse.json(
      {
        versions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('GET /api/extensions/[id]/versions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

/**
 * POST /api/extensions/[id]/versions — Upload a new version (owner only)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders(request) }
      );
    }

    const { id } = await context.params;

    const extension = await prisma.extension.findUnique({
      where: { id },
      select: { id: true, authorId: true, slug: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    if (extension.authorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the extension author can publish new versions' },
        { status: 403, headers: corsHeaders(request) }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Extension file (ZIP) is required' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 50MB limit' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Only ZIP files are accepted' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // MED-29: Content-Type validation
    if (file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      return NextResponse.json(
        { error: 'Invalid file type. Only ZIP files are accepted.' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Validate ZIP magic bytes
    const magicBuffer = Buffer.from(await file.slice(0, 4).arrayBuffer());
    if (magicBuffer[0] !== 0x50 || magicBuffer[1] !== 0x4B || magicBuffer[2] !== 0x03 || magicBuffer[3] !== 0x04) {
      return NextResponse.json(
        { error: 'Invalid ZIP file' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const versionStr = formData.get('version')?.toString() || '';
    const changeLog = formData.get('changeLog')?.toString() || '';

    const parsed = versionSchema.safeParse({ version: versionStr, changeLog });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Check for duplicate version
    const existingVersion = await prisma.extensionVersion.findUnique({
      where: {
        extensionId_version: {
          extensionId: id,
          version: parsed.data.version,
        },
      },
    });

    if (existingVersion) {
      return NextResponse.json(
        { error: `Version ${parsed.data.version} already exists` },
        { status: 409, headers: corsHeaders(request) }
      );
    }

    // Compute checksum
    const arrayBuffer = await file.arrayBuffer();
    const checksum = await computeChecksum(arrayBuffer);

    // Upload and create version in a transaction
    const version = await prisma.$transaction(async (tx) => {
      // Upload to Vercel Blob
      const { url, downloadUrl } = await uploadExtensionFile(
        file,
        id,
        parsed.data.version,
        extension.slug,
      );

      // Unset previous latest
      await tx.extensionVersion.updateMany({
        where: { extensionId: id, isLatest: true },
        data: { isLatest: false },
      });

      // Create new version
      const newVersion = await tx.extensionVersion.create({
        data: {
          extensionId: id,
          version: parsed.data.version,
          changeLog: parsed.data.changeLog || null,
          downloadUrl,
          blobUrl: url,
          fileSize: file.size,
          checksum,
          isLatest: true,
        },
      });

      // Update extension with latest version info
      await tx.extension.update({
        where: { id },
        data: {
          version: parsed.data.version,
          downloadUrl,
          fileSize: file.size,
          checksum,
        },
      });

      return newVersion;
    });

    return NextResponse.json(version, { status: 201, headers: corsHeaders(request) });
  } catch (error) {
    console.error('POST /api/extensions/[id]/versions error:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
