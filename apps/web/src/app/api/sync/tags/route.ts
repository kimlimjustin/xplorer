import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

/**
 * GET /api/sync/tags — Fetch all synced tags for the authenticated user
 */
export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders(request) },
      );
    }

    const tags = await prisma.syncedTag.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    });

    // Group tags by filePath for the client (matches the local HashMap<String, Vec<FileTag>> format)
    const grouped: Record<string, Array<{ name: string; color: string }>> = {};
    for (const tag of tags) {
      if (!grouped[tag.filePath]) {
        grouped[tag.filePath] = [];
      }
      grouped[tag.filePath].push({ name: tag.name, color: tag.color });
    }

    return NextResponse.json({ tags: grouped }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('GET /api/sync/tags error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch synced tags' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

/**
 * PUT /api/sync/tags — Full-replace sync: client sends all tags, server replaces.
 *
 * Body: { tags: Record<filePath, Array<{ name, color }>> }
 */
export async function PUT(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders(request) },
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const incoming: Record<string, Array<{ name: string; color: string }>> = body.tags;

    if (typeof incoming !== 'object' || incoming === null) {
      return NextResponse.json(
        { error: 'Invalid body: tags must be an object mapping filePath to tag arrays' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Flatten the grouped format into individual rows
    const rows: Array<{ filePath: string; name: string; color: string }> = [];
    for (const [filePath, tagList] of Object.entries(incoming)) {
      if (!Array.isArray(tagList)) continue;
      for (const tag of tagList) {
        rows.push({ filePath, name: tag.name, color: tag.color });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.syncedTag.deleteMany({ where: { userId } });

      if (rows.length > 0) {
        await tx.syncedTag.createMany({
          data: rows.map((r) => ({
            userId,
            filePath: r.filePath,
            name: r.name,
            color: r.color,
          })),
        });
      }
    });

    return NextResponse.json(
      { tags: incoming, syncedAt: new Date().toISOString() },
      { headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error('PUT /api/sync/tags error:', error);
    return NextResponse.json(
      { error: 'Failed to sync tags' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

/**
 * PATCH /api/sync/tags — Incremental sync: upsert/delete individual tags.
 *
 * Body: {
 *   upsert?: Array<{ filePath, name, color }>,
 *   delete?: Array<{ filePath, name }>
 * }
 */
export async function PATCH(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders(request) },
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const upserts: Array<{ filePath: string; name: string; color: string }> = body.upsert || [];
    const deletes: Array<{ filePath: string; name: string }> = body.delete || [];

    await prisma.$transaction(async (tx) => {
      // Delete specified tags
      for (const d of deletes) {
        await tx.syncedTag.deleteMany({
          where: {
            userId,
            filePath: d.filePath,
            name: d.name,
          },
        });
      }

      // Upsert tags
      for (const t of upserts) {
        await tx.syncedTag.upsert({
          where: {
            userId_filePath_name: { userId, filePath: t.filePath, name: t.name },
          },
          create: {
            userId,
            filePath: t.filePath,
            name: t.name,
            color: t.color,
          },
          update: {
            color: t.color,
          },
        });
      }
    });

    // Return the full updated grouped list
    const allTags = await prisma.syncedTag.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, Array<{ name: string; color: string }>> = {};
    for (const tag of allTags) {
      if (!grouped[tag.filePath]) {
        grouped[tag.filePath] = [];
      }
      grouped[tag.filePath].push({ name: tag.name, color: tag.color });
    }

    return NextResponse.json(
      { tags: grouped, syncedAt: new Date().toISOString() },
      { headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error('PATCH /api/sync/tags error:', error);
    return NextResponse.json(
      { error: 'Failed to sync tags' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

/**
 * OPTIONS — CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return (
    handleCors(request) ?? new NextResponse(null, { status: 200, headers: corsHeaders(request) })
  );
}
