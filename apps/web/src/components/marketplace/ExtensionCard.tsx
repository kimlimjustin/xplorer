import Link from 'next/link';
import { Download, Star } from 'lucide-react';
import { cn, formatDownloadCount, safeImageUrl } from '@/lib/utils';
import { PriceBadge } from './PriceBadge';

export interface ExtensionCardData {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  icon?: string | null;
  downloadCount: number;
  averageRating: number;
  reviewCount: number;
  pricingType: string;
  price?: number | null;
  author: {
    name?: string | null;
    username?: string | null;
  };
  categories: Array<{ category: { name: string; slug: string } }>;
}

export function ExtensionCard({ extension }: { extension: ExtensionCardData }) {
  return (
    <Link
      href={`/extensions/${extension.slug}`}
      className="group block border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-200 dark:border-gray-800 dark:hover:border-gray-700"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="h-12 w-12 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 text-brand-600 font-bold text-lg group-hover:bg-brand-100 transition-colors dark:bg-brand-500/10 dark:text-brand-400 dark:group-hover:bg-brand-500/20">
          {extension.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeImageUrl(extension.icon)}
              alt=""
              className="h-8 w-8 rounded"
            />
          ) : (
            extension.displayName.charAt(0).toUpperCase()
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand-700 transition-colors dark:text-white dark:group-hover:text-brand-400">
              {extension.displayName}
            </h3>
            <PriceBadge
              pricingType={extension.pricingType}
              price={extension.price}
            />
          </div>
          <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
            by {extension.author.name || extension.author.username}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-600 line-clamp-2 leading-relaxed dark:text-gray-400">
        {extension.description}
      </p>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <Download className="h-3.5 w-3.5" />
          {formatDownloadCount(extension.downloadCount)}
        </span>
        {extension.averageRating > 0 && (
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            {extension.averageRating.toFixed(1)}
            <span className="text-gray-300 dark:text-gray-600">({extension.reviewCount})</span>
          </span>
        )}
        {extension.categories.length > 0 && (
          <span className="truncate">
            {extension.categories.map((c) => c.category.name).join(', ')}
          </span>
        )}
      </div>
    </Link>
  );
}
