import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { stripe, PLANS } from '@/lib/stripe';
import { checkoutSchema } from '@/lib/validation';
import { checkoutLimiter, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/billing/checkout — Create a Stripe checkout session for a paid extension purchase.
 *
 * Pro subscriptions are handled via GitHub Sponsors, not Stripe.
 */
export async function POST(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    try {
      await checkoutLimiter.check(10, getClientIp(request));
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

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const { extensionId } = parsed.data;

    if (!extensionId) {
      return NextResponse.json(
        { error: 'extensionId is required. Pro upgrades are handled via GitHub Sponsors.' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe().customers.create({
        email: user.email || undefined,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
      select: {
        id: true,
        slug: true,
        displayName: true,
        price: true,
        pricingType: true,
        currency: true,
        authorId: true,
        author: {
          select: { stripeConnectAccountId: true, stripeConnectOnboarded: true },
        },
      },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    if (extension.pricingType !== 'PAID' || !extension.price) {
      return NextResponse.json(
        { error: 'This extension is free' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    if (!extension.author.stripeConnectAccountId || !extension.author.stripeConnectOnboarded) {
      return NextResponse.json(
        { error: 'Extension author has not completed payment setup' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // HIGH-W04: Use upsert with a 'pending' status to atomically claim the purchase slot.
    // This prevents race conditions where concurrent requests both pass the "already purchased" check.
    // The unique constraint on userId_extensionId ensures only one request wins.
    const feePercent = user.subscriptionTier === 'PRO'
      ? PLANS.PRO.platformFeePercent
      : PLANS.FREE.platformFeePercent;
    const applicationFeeAmount = Math.round(extension.price * (feePercent / 100));

    try {
      const purchase = await prisma.purchase.upsert({
        where: {
          userId_extensionId: { userId: user.id, extensionId },
        },
        update: {
          // If a completed purchase already exists, this is a no-op — we detect it below
        },
        create: {
          userId: user.id,
          extensionId,
          amount: extension.price,
          platformFee: applicationFeeAmount,
          authorPayout: extension.price - applicationFeeAmount,
          currency: extension.currency,
          status: 'pending',
        },
      });

      // If the purchase already exists and is completed, block duplicate checkout
      if (purchase.status === 'completed') {
        return NextResponse.json(
          { error: 'You have already purchased this extension' },
          { status: 400, headers: corsHeaders(request) }
        );
      }
    } catch (err: any) {
      // Handle unique constraint violation (P2002) from concurrent requests
      if (err?.code === 'P2002') {
        return NextResponse.json(
          { error: 'A checkout is already in progress for this extension' },
          { status: 409, headers: corsHeaders(request) }
        );
      }
      throw err;
    }

    const checkoutSession = await stripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: extension.currency,
            product_data: {
              name: extension.displayName,
              metadata: { extensionId: extension.id },
            },
            unit_amount: extension.price,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: extension.author.stripeConnectAccountId,
        },
        metadata: {
          type: 'extension_purchase',
          extensionId: extension.id,
          userId: user.id,
          platformFee: applicationFeeAmount.toString(),
        },
      },
      metadata: {
        type: 'extension_purchase',
        extensionId: extension.id,
        userId: user.id,
      },
      success_url: `${appUrl}/extensions/${extension.slug}?purchased=true`,
      cancel_url: `${appUrl}/extensions/${extension.slug}`,
    });

    // Update the pending purchase with the Stripe session ID
    await prisma.purchase.update({
      where: {
        userId_extensionId: { userId: user.id, extensionId },
      },
      data: {
        stripeSessionId: checkoutSession.id,
      },
    });

    return NextResponse.json(
      { url: checkoutSession.url },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('POST /api/billing/checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
