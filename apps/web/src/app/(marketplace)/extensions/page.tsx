import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE_NAME } from '@/lib/constants';
import { ExtensionBrowser } from '@/components/marketplace/ExtensionBrowser';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Extensions Marketplace | ${SITE_NAME}`,
  description:
    'Browse and install extensions for Xplorer. Themes, previews, productivity tools, and more.',
};

async function getExtensions() {
  const extensions = await prisma.extension.findMany({
    where: {
      isPublished: true,
      status: 'APPROVED',
    },
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
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: {
      downloadCount: 'desc',
    },
  });

  return extensions.map((ext) => ({
    id: ext.id,
    slug: ext.slug,
    displayName: ext.displayName,
    description: ext.description,
    icon: ext.icon,
    downloadCount: ext.downloadCount,
    averageRating: ext.averageRating,
    reviewCount: ext.reviewCount,
    pricingType: ext.pricingType,
    price: ext.price,
    author: ext.author,
    categories: ext.categories,
  }));
}

async function getCategories() {
  return prisma.category.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
}

export default async function ExtensionsPage() {
  const [extensions, categories] = await Promise.all([
    getExtensions(),
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero banner */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
          Extension Marketplace
        </h1>
        <p className="mt-3 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Discover themes, previews, and tools built by the community to customize
          and extend your Xplorer experience.
        </p>
        <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-400 dark:text-gray-500">
          <span>{extensions.length} extensions</span>
          <span>{categories.length} categories</span>
        </div>
      </div>

      <ExtensionBrowser extensions={extensions} categories={categories} />
    </div>
  );
}
