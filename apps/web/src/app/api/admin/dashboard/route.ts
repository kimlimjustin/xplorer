import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [totalExtensions, totalUsers, totalDownloads, pendingReviews, recentExtensions] =
    await Promise.all([
      prisma.extension.count(),
      prisma.user.count(),
      prisma.download.count(),
      prisma.extension.count({ where: { status: 'PENDING' } }),
      prisma.extension.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          author: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      }),
    ]);

  return NextResponse.json({
    totalExtensions,
    totalUsers,
    totalDownloads,
    pendingReviews,
    recentExtensions,
  });
}
