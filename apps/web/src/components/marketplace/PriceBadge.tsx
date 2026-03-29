import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils';

export interface PriceBadgeProps {
  pricingType: string;
  price?: number | null;
  className?: string;
}

export function PriceBadge({ pricingType, price, className }: PriceBadgeProps) {
  if (pricingType === 'FREE') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400',
          className,
        )}
      >
        Free
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
        className,
      )}
    >
      {price ? formatPrice(price) : 'Paid'}
    </span>
  );
}
