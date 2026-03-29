import Link from 'next/link';
import { Download, Star } from 'lucide-react';
import { formatDownloadCount, safeImageUrl } from '@/lib/utils';
import { PriceBadge } from './PriceBadge';
import type { ExtensionCardData } from './ExtensionCard';

export function ExtensionListItem({ extension }: { extension: ExtensionCardData }) {
  return (
    <Link
      href={`/extensions/${extension.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-gray-200 px-5 py-4 transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:hover:border-gray-700"
    >
      {/* Icon */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg font-bold text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:group-hover:bg-brand-500/20">
        {extension.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeImageUrl(extension.icon)} alt="" className="h-8 w-8 rounded" />
        ) : (
          extension.displayName.charAt(0).toUpperCase()
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-400">
            {extension.displayName}
          </h3>
          <PriceBadge pricingType={extension.pricingType} price={extension.price} />
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          by {extension.author.name || extension.author.username}
        </p>
        <p className="mt-1 line-clamp-1 text-sm text-gray-600 dark:text-gray-400">
          {extension.description}
        </p>
      </div>

      {/* Meta */}
      <div className="hidden shrink-0 items-center gap-6 text-sm text-gray-400 dark:text-gray-500 sm:flex">
        <span className="flex min-w-[60px] items-center gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {formatDownloadCount(extension.downloadCount)}
        </span>
        {extension.averageRating > 0 && (
          <span className="flex min-w-[60px] items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            {extension.averageRating.toFixed(1)}
          </span>
        )}
        {extension.categories.length > 0 && (
          <span className="hidden max-w-[120px] truncate text-xs lg:block">
            {extension.categories.map((c) => c.category.name).join(', ')}
          </span>
        )}
      </div>
    </Link>
  );
}
