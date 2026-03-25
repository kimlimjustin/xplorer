import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

/**
 * GET /api/trial/status — Check trial status for an extension
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

    const { searchParams } = new URL(request.url);
    const extensionId = searchParams.get('extensionId');

    if (!extensionId) {
      return NextResponse.json(
        { error: 'extensionId query parameter is required' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const trial = await prisma.trial.findUnique({
      where: {
        userId_extensionId: {
          userId: session.user.id,
          extensionId,
        },
      },
    });

    if (!trial) {
      return NextResponse.json(
        {
          active: false,
          expiresAt: null,
          remainingMs: 0,
          hasUsedTrial: false,
        },
        { headers: corsHeaders(request) }
      );
    }

    const now = new Date();
    const isActive = trial.expiresAt > now && !trial.isExpired;
    const remainingMs = isActive ? trial.expiresAt.getTime() - now.getTime() : 0;

    // Mark as expired if past expiration
    if (!isActive && !trial.isExpired) {
      await prisma.trial.update({
        where: { id: trial.id },
        data: { isExpired: true },
      });
    }

    return NextResponse.json(
      {
        active: isActive,
        expiresAt: trial.expiresAt,
        remainingMs,
        hasUsedTrial: true,
      },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('GET /api/trial/status error:', error);
    return NextResponse.json(
      { error: 'Failed to check trial status' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
