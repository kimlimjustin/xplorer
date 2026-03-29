import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { corsHeaders, handleCors } from '@/lib/cors';
import { categoriesLimiter, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/categories — List all categories
 */
export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit — 60 requests per minute per IP
    try {
      await categoriesLimiter.check(60, getClientIp(request));
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders(request) },
      );
    }

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { extensions: true },
        },
      },
    });

    return NextResponse.json({ categories }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
