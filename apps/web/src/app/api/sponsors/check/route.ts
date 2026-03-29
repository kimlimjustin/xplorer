import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkSponsorStatus, tierFromSponsor } from '@/lib/sponsors';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

/**
 * POST /api/sponsors/check — Refresh the current user's GitHub Sponsors status.
 * Updates subscriptionTier in the database based on live sponsor data.
 */
export async function POST(request: Request) {
  try {
    // Rate limit: 5 checks per minute
    try {
      await limiter.check(5, getClientIp(request));
    } catch {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await requireAuth();
    const username = session.user.username;

    if (!username) {
      return NextResponse.json(
        { error: 'No GitHub username linked to this account' },
        { status: 400 },
      );
    }

    const status = await checkSponsorStatus(username);
    const tier = tierFromSponsor(status);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { subscriptionTier: tier },
    });

    return NextResponse.json({
      isSponsor: status.isSponsor,
      tier: status.tier,
      subscriptionTier: tier,
    });
  } catch (err) {
    console.error('POST /api/sponsors/check error:', err);
    return NextResponse.json({ error: 'Failed to check sponsor status' }, { status: 500 });
  }
}
