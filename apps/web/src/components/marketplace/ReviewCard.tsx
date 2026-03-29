import Image from 'next/image';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/utils';

export interface ReviewData {
  id: string;
  rating: number;
  title?: string | null;
  content: string;
  createdAt: string;
  user: {
    name?: string | null;
    image?: string | null;
    username: string;
  };
}

export function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            sizeClass,
            i < rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700',
          )}
        />
      ))}
    </div>
  );
}

export function ReviewCard({ review }: { review: ReviewData }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {review.user.image ? (
            <Image
              src={review.user.image}
              alt={review.user.name || review.user.username}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {(review.user.name || review.user.username).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {review.user.name || review.user.username}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatShortDate(review.createdAt)}
            </p>
          </div>
        </div>
        <StarRating rating={review.rating} />
      </div>

      {review.title && (
        <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{review.title}</h4>
      )}
      <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {review.content}
      </p>
    </div>
  );
}
