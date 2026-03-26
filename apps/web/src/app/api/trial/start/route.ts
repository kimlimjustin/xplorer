import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { startTrialSchema } from '@/lib/validation';
import { PLANS } from '@/lib/stripe';
import { trialLimiter, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/trial/start — Start a 30-minute trial for an extension
 */
export async function POST(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // CRIT-08: Rate limit — 10 requests per minute per IP
    try {
      await trialLimiter.check(10, getClientIp(request));
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
    const parsed = startTrialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const { extensionId } = parsed.data;

    // Check extension exists
    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
      select: { id: true, displayName: true, isPublished: true, status: true, pricingType: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    if (!extension.isPublished || extension.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Extension is not available' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // HIGH-06: Reject trial creation for FREE extensions — trials only apply to paid or tier-limited extensions
    if (extension.pricingType === 'FREE') {
      return NextResponse.json(
        { error: 'Trials are not available for free extensions. You can download this extension directly.' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // HIGH-06: Use upsert to prevent race conditions with concurrent trial creation
    const trialDuration = PLANS.FREE.trialDurationMs; // 30 minutes
    const expiresAt = new Date(Date.now() + trialDuration);

    const trial = await prisma.trial.upsert({
      where: {
        userId_extensionId: {
          userId: session.user.id,
          extensionId,
        },
      },
      update: {
        // No-op update: if trial already exists, do not modify it
      },
      create: {
        userId: session.user.id,
        extensionId,
        expiresAt,
      },
    });

    // Check if the returned trial is still active
    if (trial.expiresAt > new Date() && !trial.isExpired) {
      const remainingMs = trial.expiresAt.getTime() - Date.now();
      // Determine if this was an existing trial or newly created
      const isNew = Math.abs(trial.expiresAt.getTime() - expiresAt.getTime()) < 5000;
      return NextResponse.json(
        {
          trial,
          active: true,
          remainingMs,
          message: isNew
            ? `Trial started for ${extension.displayName}. Expires in 30 minutes.`
            : 'Trial is already active',
        },
        { status: isNew ? 201 : 200, headers: corsHeaders(request) }
      );
    }

    // Trial already used and expired
    return NextResponse.json(
      { error: 'Trial already used for this extension. Please purchase or upgrade to Pro.' },
      { status: 400, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('POST /api/trial/start error:', error);
    return NextResponse.json(
      { error: 'Failed to start trial' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
