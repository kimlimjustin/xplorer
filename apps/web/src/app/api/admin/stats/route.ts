import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

/**
 * GET /api/admin/stats — Get admin dashboard statistics
 */
export async function GET(request: NextRequest) {
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
    const [totalExtensions, totalUsers, totalDownloads, pendingReviews] = await Promise.all([
      prisma.extension.count(),
      prisma.user.count(),
      prisma.download.count(),
      prisma.extension.count({ where: { status: 'PENDING' } }),
    ]);

    return NextResponse.json(
      {
        totalExtensions,
        totalUsers,
        totalDownloads,
        pendingReviews,
      },
      { headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
