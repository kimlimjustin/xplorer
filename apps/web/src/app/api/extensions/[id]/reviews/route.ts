import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { reviewSchema } from '@/lib/validation';
import { reviewLimiter, getClientIp } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/extensions/[id]/reviews — List reviews for an extension
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    // MED-W03: Explicit pagination validation with NaN protection
    const page = Math.max(1, Math.min(10000, parseInt(searchParams.get('page') || '1', 10) || 1));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));

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

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { extensionId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      }),
      prisma.review.count({ where: { extensionId: id } }),
    ]);

    return NextResponse.json(
      {
        reviews,
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
    console.error('GET /api/extensions/[id]/reviews error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

/**
 * POST /api/extensions/[id]/reviews — Create a review
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // CRIT-08: Rate limit — 5 requests per minute per IP
    try {
      await reviewLimiter.check(5, getClientIp(request));
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders(request) }
      );
    }

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
      select: { id: true, authorId: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    // Prevent self-review
    if (extension.authorId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot review your own extension' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Check for existing review
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_extensionId: {
          userId: session.user.id,
          extensionId: id,
        },
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this extension' },
        { status: 409, headers: corsHeaders(request) }
      );
    }

    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // HIGH-W08: Wrap review creation + rating recalculation in a transaction
    // to ensure atomicity — the extension's averageRating always reflects all reviews.
    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          rating: parsed.data.rating,
          title: parsed.data.title || null,
          content: parsed.data.content,
          userId: session.user.id,
          extensionId: id,
        },
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      });

      // Recalculate average rating within the same transaction
      const aggregation = await tx.review.aggregate({
        where: { extensionId: id },
        _avg: { rating: true },
        _count: true,
      });

      await tx.extension.update({
        where: { id },
        data: {
          averageRating: aggregation._avg.rating || 0,
          reviewCount: aggregation._count,
        },
      });

      return newReview;
    });

    return NextResponse.json(review, { status: 201, headers: corsHeaders(request) });
  } catch (error) {
    console.error('POST /api/extensions/[id]/reviews error:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
