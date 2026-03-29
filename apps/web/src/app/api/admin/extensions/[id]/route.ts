import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/extensions/[id] — Get a single extension with full details (admin)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403, headers: corsHeaders(request) },
    );
  }

  try {
    const { id } = await context.params;

    const extension = await prisma.extension.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            image: true,
          },
        },
        categories: { include: { category: true } },
        versions: { orderBy: { createdAt: 'desc' } },
        reviews: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { reviews: true, versions: true, downloads: true, purchases: true } },
      },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    return NextResponse.json(extension, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('GET /api/admin/extensions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extension' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

/**
 * POST /api/admin/extensions/[id] — Handle approve/reject actions (admin)
 *
 * The admin UI calls:
 *   POST /api/admin/extensions/{id}/approve
 *   POST /api/admin/extensions/{id}/reject
 *
 * But since Next.js App Router doesn't support those sub-paths without
 * additional route files, this handler accepts an `action` body field
 * OR the admin page can call this route directly with { action: 'approve' | 'reject' }.
 *
 * For backward compat with the admin page that calls /approve and /reject paths,
 * see the catch-all route at [id]/[action]/route.ts.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403, headers: corsHeaders(request) },
    );
  }

  try {
    const { id } = await context.params;

    let action: string | undefined;
    try {
      const body = await request.json();
      action = body.action;
    } catch {
      // Body may be empty for simple action calls
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject".' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const extension = await prisma.extension.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const data: Record<string, any> = {
      status: newStatus,
    };

    if (action === 'approve') {
      data.isPublished = true;
      data.publishedAt = new Date();
    } else {
      data.isPublished = false;
    }

    const updated = await prisma.extension.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, name: true, username: true, image: true } },
        categories: { include: { category: true } },
      },
    });

    return NextResponse.json(updated, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('POST /api/admin/extensions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update extension' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
