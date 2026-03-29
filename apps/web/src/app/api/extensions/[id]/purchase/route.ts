import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { stripe, PLANS } from '@/lib/stripe';
import { purchaseLimiter, getClientIp } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/extensions/[id]/purchase — Create a Stripe Checkout session
 * for purchasing a paid extension.
 *
 * Body: { returnUrl?: string }
 * Returns: { url: string } — Stripe Checkout URL
 *
 * Flow:
 * 1. Validate the extension is paid, published, and purchasable
 * 2. Ensure the buyer hasn't already purchased it
 * 3. Ensure the author has completed Stripe Connect onboarding
 * 4. Create or reuse a Stripe Customer for the buyer
 * 5. Create a pending Purchase record (atomic via upsert)
 * 6. Create a Stripe Checkout session with application_fee + transfer
 * 7. Return the Checkout URL
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit — 10 requests per minute per IP
    try {
      await purchaseLimiter.check(10, getClientIp(request));
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders(request) },
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders(request) },
      );
    }

    const { id: extensionId } = await context.params;

    // Parse optional returnUrl from body
    let returnUrl: string | undefined;
    try {
      const body = await request.json();
      returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl : undefined;
    } catch {
      // Empty body is acceptable
    }

    // Fetch the extension with author Connect details
    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
      select: {
        id: true,
        slug: true,
        displayName: true,
        price: true,
        pricingType: true,
        currency: true,
        isPublished: true,
        status: true,
        authorId: true,
        author: {
          select: {
            stripeConnectAccountId: true,
            stripeConnectOnboarded: true,
          },
        },
      },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    // Extension must be published and approved
    if (!extension.isPublished || extension.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Extension is not available for purchase' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Must be a paid extension with a valid price
    if (extension.pricingType !== 'PAID' || !extension.price) {
      return NextResponse.json(
        { error: 'This extension is free and does not require purchase' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Authors cannot purchase their own extensions
    if (extension.authorId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot purchase your own extension' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Author must have completed Stripe Connect onboarding
    if (!extension.author.stripeConnectAccountId || !extension.author.stripeConnectOnboarded) {
      return NextResponse.json(
        { error: 'Extension author has not completed payment setup' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Fetch buyer details
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
        { status: 404, headers: corsHeaders(request) },
      );
    }

    // Create or reuse Stripe Customer
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

    // Calculate platform fee based on buyer's subscription tier
    const tier = (user.subscriptionTier as keyof typeof PLANS) || 'FREE';
    const feePercent = PLANS[tier]?.platformFeePercent ?? PLANS.FREE.platformFeePercent;
    const applicationFeeAmount = Math.round(extension.price * (feePercent / 100));

    // Atomically create a pending purchase (prevents duplicate checkout race conditions)
    try {
      const purchase = await prisma.purchase.upsert({
        where: {
          userId_extensionId: { userId: user.id, extensionId },
        },
        update: {
          // If a completed purchase exists, the upsert is a no-op; we detect it below
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

      if (purchase.status === 'completed') {
        return NextResponse.json(
          { error: 'You have already purchased this extension' },
          { status: 400, headers: corsHeaders(request) },
        );
      }
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json(
          { error: 'A checkout is already in progress for this extension' },
          { status: 409, headers: corsHeaders(request) },
        );
      }
      throw err;
    }

    // Build success/cancel URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = returnUrl || `${appUrl}/extensions/${extension.slug}?purchased=true`;
    const cancelUrl = `${appUrl}/extensions/${extension.slug}`;

    // Create Stripe Checkout session with Connect transfer
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
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // Link the Stripe session to the pending purchase
    await prisma.purchase.update({
      where: {
        userId_extensionId: { userId: user.id, extensionId },
      },
      data: {
        stripeSessionId: checkoutSession.id,
      },
    });

    return NextResponse.json({ url: checkoutSession.url }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('POST /api/extensions/[id]/purchase error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
