import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

type RouteContext = { params: Promise<{ id: string; action: string }> };

/**
 * POST /api/admin/extensions/[id]/approve — Approve an extension
 * POST /api/admin/extensions/[id]/reject  — Reject an extension
 *
 * Both require admin authentication.
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
    const { id, action } = await context.params;

    if (!['approve', 'reject'].includes(action)) {
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
    console.error(`POST /api/admin/extensions/[id]/[action] error:`, error);
    return NextResponse.json(
      { error: 'Failed to update extension' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
