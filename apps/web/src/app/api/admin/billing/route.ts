import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';

/**
 * GET /api/admin/billing — Get revenue and billing statistics (admin)
 */
export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403, headers: corsHeaders(request) },
    );
  }

  try {
    // Total purchases stats
    const purchaseStats = await prisma.purchase.aggregate({
      _count: true,
      _sum: {
        amount: true,
        platformFee: true,
        authorPayout: true,
      },
    });

    // Total donations stats
    const donationStats = await prisma.donation.aggregate({
      _count: true,
      _sum: {
        amount: true,
      },
    });

    // Monthly breakdown (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const recentPurchases = await prisma.purchase.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: {
        amount: true,
        platformFee: true,
        authorPayout: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const recentDonations = await prisma.donation.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build monthly breakdown
    const monthlyMap = new Map<
      string,
      {
        purchases: number;
        purchaseRevenue: number;
        platformFees: number;
        donations: number;
        donationRevenue: number;
      }
    >();

    for (const p of recentPurchases) {
      const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyMap.get(key) || {
        purchases: 0,
        purchaseRevenue: 0,
        platformFees: 0,
        donations: 0,
        donationRevenue: 0,
      };
      entry.purchases++;
      entry.purchaseRevenue += p.amount;
      entry.platformFees += p.platformFee;
      monthlyMap.set(key, entry);
    }

    for (const d of recentDonations) {
      const key = `${d.createdAt.getFullYear()}-${String(d.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyMap.get(key) || {
        purchases: 0,
        purchaseRevenue: 0,
        platformFees: 0,
        donations: 0,
        donationRevenue: 0,
      };
      entry.donations++;
      entry.donationRevenue += d.amount;
      monthlyMap.set(key, entry);
    }

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    return NextResponse.json(
      {
        totalPurchases: purchaseStats._count,
        totalRevenue: purchaseStats._sum.amount || 0,
        totalPlatformFees: purchaseStats._sum.platformFee || 0,
        totalAuthorPayouts: purchaseStats._sum.authorPayout || 0,
        totalDonations: donationStats._count,
        totalDonationRevenue: donationStats._sum.amount || 0,
        monthlyBreakdown,
      },
      { headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error('GET /api/admin/billing error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing stats' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
