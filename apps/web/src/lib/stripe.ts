import Stripe from 'stripe';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia' as any,
  });
}

let _stripe: Stripe | undefined;
export function stripe() {
  if (!_stripe) _stripe = getStripe();
  return _stripe;
}

/**
 * Format a price amount (in cents) to a human-readable currency string.
 */
export function formatPrice(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

export const PLANS = {
  FREE: {
    name: 'Free',
    maxExtensions: 20,
    platformFeePercent: 30,
    trialDurationMs: 30 * 60 * 1000,
  },
  PRO: {
    name: 'Pro',
    maxExtensions: Infinity,
    platformFeePercent: 10,
    trialDurationMs: 0,
  },
} as const;

