import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const extensions = await prisma.extension.findMany({
    where: { authorId: userId },
    include: {
      _count: { select: { reviews: true, versions: true } },
      categories: { include: { category: { select: { name: true, slug: true } } } },
    },
    orderBy: { downloadCount: 'desc' },
  });

  const extensionIds = extensions.map((e) => e.id);

  const [totalDownloads, totalRevenue, recentDownloads] = await Promise.all([
    prisma.download.count({
      where: { extensionId: { in: extensionIds } },
    }),
    prisma.purchase.aggregate({
      where: { extensionId: { in: extensionIds } },
      _sum: { authorPayout: true },
    }),
    extensionIds.length > 0
      ? prisma.download.groupBy({
          by: ['createdAt'],
          where: {
            extensionId: { in: extensionIds },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          _count: true,
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const totalRatings = extensions.reduce((sum, e) => sum + e.averageRating * e._count.reviews, 0);
  const totalReviews = extensions.reduce((sum, e) => sum + e._count.reviews, 0);
  const averageRating = totalReviews > 0 ? totalRatings / totalReviews : 0;

  // Group downloads by day for the chart
  const downloadsByDay: Record<string, number> = {};
  for (const dl of recentDownloads) {
    const day = new Date(dl.createdAt).toISOString().split('T')[0];
    downloadsByDay[day] = (downloadsByDay[day] || 0) + dl._count;
  }

  // Fill in missing days for the last 30 days
  const downloadChart: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    downloadChart.push({ date: key, count: downloadsByDay[key] || 0 });
  }

  return NextResponse.json({
    extensions: extensions.map((ext) => ({
      id: ext.id,
      slug: ext.slug,
      displayName: ext.displayName,
      version: ext.version,
      status: ext.status,
      downloadCount: ext.downloadCount,
      averageRating: ext.averageRating,
      reviewCount: ext._count.reviews,
      pricingType: ext.pricingType,
      price: ext.price,
      updatedAt: ext.updatedAt.toISOString(),
      categories: ext.categories,
    })),
    stats: {
      totalExtensions: extensions.length,
      totalDownloads,
      averageRating,
      totalRevenue: totalRevenue._sum.authorPayout || 0,
    },
    downloadChart,
  });
}
