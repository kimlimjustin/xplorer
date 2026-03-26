import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

/**
 * GET /api/sync/bookmarks — Fetch all synced bookmarks for the authenticated user
 */
export async function GET(request: NextRequest) {
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

    const bookmarks = await prisma.syncedBookmark.findMany({
      where: { userId: session.user.id },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ bookmarks }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('GET /api/sync/bookmarks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch synced bookmarks' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

/**
 * PUT /api/sync/bookmarks — Full-replace sync: client sends all bookmarks, server replaces.
 *
 * Body: { bookmarks: Array<{ path, name, icon?, pinned?, sortOrder? }> }
 */
export async function PUT(request: NextRequest) {
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

    const userId = session.user.id;
    const body = await request.json();
    const incoming: Array<{
      path: string;
      name: string;
      icon?: string | null;
      pinned?: boolean;
      sortOrder?: number;
    }> = body.bookmarks;

    if (!Array.isArray(incoming)) {
      return NextResponse.json(
        { error: 'Invalid body: bookmarks must be an array' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Use a transaction: delete all existing, then create new ones
    const result = await prisma.$transaction(async (tx) => {
      await tx.syncedBookmark.deleteMany({ where: { userId } });

      if (incoming.length === 0) return [];

      await tx.syncedBookmark.createMany({
        data: incoming.map((b, i) => ({
          userId,
          path: b.path,
          name: b.name,
          icon: b.icon ?? null,
          pinned: b.pinned ?? false,
          sortOrder: b.sortOrder ?? i,
        })),
      });

      return tx.syncedBookmark.findMany({
        where: { userId },
        orderBy: { sortOrder: 'asc' },
      });
    });

    return NextResponse.json(
      { bookmarks: result, syncedAt: new Date().toISOString() },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('PUT /api/sync/bookmarks error:', error);
    return NextResponse.json(
      { error: 'Failed to sync bookmarks' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

/**
 * PATCH /api/sync/bookmarks — Incremental sync: upsert individual bookmarks.
 *
 * Body: { upsert?: Array<{ path, name, icon?, pinned?, sortOrder? }>, delete?: string[] (paths) }
 */
export async function PATCH(request: NextRequest) {
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

    const userId = session.user.id;
    const body = await request.json();
    const upserts: Array<{
      path: string;
      name: string;
      icon?: string | null;
      pinned?: boolean;
      sortOrder?: number;
    }> = body.upsert || [];
    const deletes: string[] = body.delete || [];

    await prisma.$transaction(async (tx) => {
      // Delete specified bookmarks
      if (deletes.length > 0) {
        await tx.syncedBookmark.deleteMany({
          where: {
            userId,
            path: { in: deletes },
          },
        });
      }

      // Upsert bookmarks
      for (const b of upserts) {
        await tx.syncedBookmark.upsert({
          where: {
            userId_path: { userId, path: b.path },
          },
          create: {
            userId,
            path: b.path,
            name: b.name,
            icon: b.icon ?? null,
            pinned: b.pinned ?? false,
            sortOrder: b.sortOrder ?? 0,
          },
          update: {
            name: b.name,
            icon: b.icon ?? null,
            pinned: b.pinned ?? false,
            sortOrder: b.sortOrder ?? 0,
          },
        });
      }
    });

    // Return the full updated list
    const bookmarks = await prisma.syncedBookmark.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(
      { bookmarks, syncedAt: new Date().toISOString() },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('PATCH /api/sync/bookmarks error:', error);
    return NextResponse.json(
      { error: 'Failed to sync bookmarks' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

/**
 * OPTIONS — CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return handleCors(request) ?? new NextResponse(null, { status: 200, headers: corsHeaders(request) });
}
