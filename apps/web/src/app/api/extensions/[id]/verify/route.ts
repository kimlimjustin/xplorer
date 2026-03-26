import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { corsHeaders, handleCors } from '@/lib/cors';
import { verifyLimiter, getClientIp } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/extensions/[id]/verify — Verify if a user has purchased an extension
 *
 * Query: ?userId=xxx
 * Returns: { purchased: boolean, purchasedAt: string | null }
 *
 * This endpoint is intentionally public (no auth required) so the
 * desktop client can verify licenses without requiring the user to
 * re-authenticate through the web app. The userId is a non-guessable
 * CUID, providing sufficient security for license checks.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit — 120 requests per minute per IP (same as extension detail)
    try {
      await verifyLimiter.check(120, getClientIp(request));
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders(request) }
      );
    }

    const { id: extensionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Verify the extension exists
    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
      select: {
        id: true,
        pricingType: true,
        authorId: true,
      },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    // Free extensions are always "purchased"
    if (extension.pricingType === 'FREE') {
      return NextResponse.json(
        {
          purchased: true,
          purchasedAt: null,
          reason: 'free_extension',
        },
        { headers: corsHeaders(request) }
      );
    }

    // Authors always have access to their own extensions
    if (extension.authorId === userId) {
      return NextResponse.json(
        {
          purchased: true,
          purchasedAt: null,
          reason: 'author',
        },
        { headers: corsHeaders(request) }
      );
    }

    // Check for a completed purchase
    const purchase = await prisma.purchase.findUnique({
      where: {
        userId_extensionId: { userId, extensionId },
      },
      select: {
        status: true,
        createdAt: true,
      },
    });

    if (purchase && purchase.status === 'completed') {
      return NextResponse.json(
        {
          purchased: true,
          purchasedAt: purchase.createdAt.toISOString(),
        },
        { headers: corsHeaders(request) }
      );
    }

    // Also check for an active trial
    const activeTrial = await prisma.trial.findFirst({
      where: {
        userId,
        extensionId,
        expiresAt: { gt: new Date() },
        isExpired: false,
      },
      select: {
        expiresAt: true,
      },
    });

    if (activeTrial) {
      return NextResponse.json(
        {
          purchased: false,
          purchasedAt: null,
          trial: true,
          trialExpiresAt: activeTrial.expiresAt.toISOString(),
        },
        { headers: corsHeaders(request) }
      );
    }

    return NextResponse.json(
      {
        purchased: false,
        purchasedAt: null,
      },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('GET /api/extensions/[id]/verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify purchase' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
