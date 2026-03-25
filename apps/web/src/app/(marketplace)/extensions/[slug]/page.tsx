import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE_NAME } from '@/lib/constants';
import { ExtensionDetail } from '@/components/marketplace/ExtensionDetail';

export const dynamic = 'force-dynamic';

interface ExtensionPageProps {
  params: Promise<{ slug: string }>;
}

async function getExtension(slug: string) {
  const extension = await prisma.extension.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          name: true,
          username: true,
          image: true,
        },
      },
      categories: {
        include: {
          category: {
            select: { name: true, slug: true },
          },
        },
      },
      versions: {
        orderBy: { createdAt: 'desc' },
      },
      reviews: {
        include: {
          user: {
            select: {
              name: true,
              username: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!extension || !extension.isPublished) return null;

  return {
    ...extension,
    publishedAt: extension.publishedAt?.toISOString() || null,
    createdAt: extension.createdAt.toISOString(),
    updatedAt: extension.updatedAt.toISOString(),
    versions: extension.versions.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    })),
    reviews: extension.reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function generateMetadata({
  params,
}: ExtensionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const extension = await getExtension(slug);
  if (!extension) return { title: 'Not Found' };

  return {
    title: `${extension.displayName} | ${SITE_NAME}`,
    description: extension.description,
    openGraph: {
      title: `${extension.displayName} | ${SITE_NAME}`,
      description: extension.description,
      type: 'website',
    },
  };
}

export default async function ExtensionPage({ params }: ExtensionPageProps) {
  const { slug } = await params;
  const extension = await getExtension(slug);

  if (!extension) {
    notFound();
  }

  return <ExtensionDetail extension={extension as any} />;
}
