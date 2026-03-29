import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

/**
 * GET /api/user/extensions — List the current user's extensions
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

    const extensions = await prisma.extension.findMany({
      where: { authorId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        categories: { include: { category: true } },
        _count: {
          select: { reviews: true, versions: true },
        },
      },
    });

    return NextResponse.json({ extensions }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('GET /api/user/extensions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user extensions' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
