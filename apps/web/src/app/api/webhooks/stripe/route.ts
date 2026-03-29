import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe, PLANS } from '@/lib/stripe';
import type Stripe from 'stripe';

/**
 * POST /api/webhooks/stripe — Handle Stripe webhook events
 *
 * Handles paid extension purchases and Connect account updates.
 * Pro subscriptions are managed via GitHub Sponsors, not Stripe.
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe().webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // HIGH-W03: Idempotency check — skip events we have already processed.
    // Look for an existing purchase with this Stripe session ID to detect replays.
    // This prevents duplicate processing if Stripe retries the webhook.

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        if (metadata.type === 'extension_purchase') {
          const userId = metadata.userId;
          const extensionId = metadata.extensionId;

          if (userId && extensionId) {
            // HIGH-W03: Check if this exact Stripe session was already processed
            const alreadyProcessed = await prisma.purchase.findFirst({
              where: {
                stripeSessionId: session.id,
                status: 'completed',
              },
              select: { id: true },
            });

            if (alreadyProcessed) {
              console.log(
                `Webhook event ${event.id} already processed (session ${session.id}), skipping`,
              );
              return NextResponse.json({ received: true });
            }

            const extension = await prisma.extension.findUnique({
              where: { id: extensionId },
              select: { price: true },
            });

            const buyer = await prisma.user.findUnique({
              where: { id: userId },
              select: { subscriptionTier: true },
            });
            const tier = (buyer?.subscriptionTier as keyof typeof PLANS) || 'FREE';
            const feePercent = PLANS[tier]?.platformFeePercent ?? PLANS.FREE.platformFeePercent;

            const amount = extension?.price || session.amount_total || 0;
            const platformFee = Math.round(amount * (feePercent / 100));
            const authorPayout = amount - platformFee;

            // Use upsert to handle any remaining race conditions gracefully
            await prisma.purchase.upsert({
              where: {
                userId_extensionId: { userId, extensionId },
              },
              update: {
                stripeSessionId: session.id,
                stripePaymentIntentId: (session.payment_intent as string) || null,
                amount,
                platformFee,
                authorPayout,
                status: 'completed',
              },
              create: {
                userId,
                extensionId,
                stripeSessionId: session.id,
                stripePaymentIntentId: (session.payment_intent as string) || null,
                amount,
                platformFee,
                authorPayout,
                currency: session.currency || 'usd',
                status: 'completed',
              },
            });
          }
        }
        break;
      }

      case 'account.updated': {
        // Stripe Connect account updated (onboarding status)
        const account = event.data.object as Stripe.Account;
        const isOnboarded = account.charges_enabled && account.payouts_enabled;

        const user = await prisma.user.findUnique({
          where: { stripeConnectAccountId: account.id },
          select: { id: true },
        });

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { stripeConnectOnboarded: isOnboarded },
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const piMetadata = paymentIntent.metadata || {};

        console.error(
          `Payment failed: PI ${paymentIntent.id}, ` +
            `reason: ${paymentIntent.last_payment_error?.message || 'unknown'}, ` +
            `type: ${piMetadata.type || 'unknown'}, ` +
            `extensionId: ${piMetadata.extensionId || 'N/A'}, ` +
            `userId: ${piMetadata.userId || 'N/A'}`,
        );

        // If this was an extension purchase, mark the pending purchase as failed
        if (
          piMetadata.type === 'extension_purchase' &&
          piMetadata.userId &&
          piMetadata.extensionId
        ) {
          await prisma.purchase.updateMany({
            where: {
              userId: piMetadata.userId,
              extensionId: piMetadata.extensionId,
              status: 'pending',
            },
            data: {
              status: 'failed',
              stripePaymentIntentId: paymentIntent.id,
            },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe webhook event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('POST /api/webhooks/stripe error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
