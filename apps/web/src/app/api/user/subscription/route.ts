import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

/**
 * GET /api/user/subscription — Get current user's subscription info
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        subscriptionExpiresAt: true,
        stripeConnectOnboarded: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    return NextResponse.json(
      {
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
        stripeSubscriptionId: user.stripeSubscriptionId,
        expiresAt: user.subscriptionExpiresAt,
        stripeConnectOnboarded: user.stripeConnectOnboarded,
      },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('GET /api/user/subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
