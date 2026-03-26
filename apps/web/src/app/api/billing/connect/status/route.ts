import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { stripe } from '@/lib/stripe';

/**
 * GET /api/billing/connect/status — Check Stripe Connect onboarding status
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
        stripeConnectAccountId: true,
        stripeConnectOnboarded: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    if (!user.stripeConnectAccountId) {
      return NextResponse.json(
        {
          hasAccount: false,
          isOnboarded: false,
          accountId: null,
        },
        { headers: corsHeaders(request) }
      );
    }

    // Check with Stripe for live status
    const account = await stripe().accounts.retrieve(user.stripeConnectAccountId);
    const isOnboarded = account.charges_enabled && account.payouts_enabled;

    // Sync onboarding status if changed
    if (isOnboarded !== user.stripeConnectOnboarded) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeConnectOnboarded: isOnboarded },
      });
    }

    return NextResponse.json(
      {
        hasAccount: true,
        isOnboarded,
        accountId: user.stripeConnectAccountId,
      },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('GET /api/billing/connect/status error:', error);
    return NextResponse.json(
      { error: 'Failed to check Connect status' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
