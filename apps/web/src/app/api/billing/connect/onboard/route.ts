import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/billing/connect/onboard — Create or continue Stripe Connect onboarding
 */
export async function POST(request: NextRequest) {
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
        id: true,
        email: true,
        stripeConnectAccountId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let accountId = user.stripeConnectAccountId;

    // Create Connect Express account if none exists
    if (!accountId) {
      const account = await stripe().accounts.create({
        type: 'express',
        email: user.email || undefined,
        metadata: { userId: user.id },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeConnectAccountId: accountId },
      });
    }

    // Create an account link for onboarding
    const accountLink = await stripe().accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/connect?refresh=true`,
      return_url: `${appUrl}/dashboard/connect?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json(
      { url: accountLink.url },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('POST /api/billing/connect/onboard error:', error);
    return NextResponse.json(
      { error: 'Failed to create onboarding link' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
