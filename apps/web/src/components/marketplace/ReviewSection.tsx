'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Star, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StarRating, ReviewCard, type ReviewData } from './ReviewCard';
import { ReviewForm } from './ReviewForm';

interface ReviewSectionProps {
  extensionId: string;
  reviews: ReviewData[];
  averageRating: number;
  reviewCount: number;
  authorUsername?: string | null;
}

function RatingBreakdown({
  reviews,
  averageRating,
  reviewCount,
}: {
  reviews: ReviewData[];
  averageRating: number;
  reviewCount: number;
}) {
  const breakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    return {
      star,
      count,
      pct: reviewCount > 0 ? (count / reviewCount) * 100 : 0,
    };
  });

  return (
    <div className="mb-6 flex items-start gap-8 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
      <div className="shrink-0 text-center">
        <p className="text-5xl font-bold text-gray-900 dark:text-white">
          {averageRating > 0 ? averageRating.toFixed(1) : '--'}
        </p>
        <StarRating rating={Math.round(averageRating)} size="md" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
        </p>
      </div>
      <div className="flex-1 space-y-1.5">
        {breakdown.map(({ star, count, pct }) => (
          <div key={star} className="flex items-center gap-2 text-sm">
            <span className="w-4 text-right text-gray-500 dark:text-gray-400">{star}</span>
            <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-400 dark:text-gray-500">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewSection({
  extensionId,
  reviews: initialReviews,
  averageRating: initialAvgRating,
  reviewCount: initialReviewCount,
  authorUsername,
}: ReviewSectionProps) {
  const { data: session, status: authStatus } = useSession();
  const [reviews, setReviews] = useState(initialReviews);
  const [averageRating, setAverageRating] = useState(initialAvgRating);
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [showForm, setShowForm] = useState(false);

  const isAuthenticated = authStatus === 'authenticated' && !!session?.user;
  const isAuthor = isAuthenticated && session.user.username === authorUsername;
  const hasReviewed =
    isAuthenticated && reviews.some((r) => r.user.username === session.user.username);
  const canReview = isAuthenticated && !isAuthor && !hasReviewed;

  function handleReviewSubmitted(review: ReviewData) {
    const updatedReviews = [review, ...reviews];
    setReviews(updatedReviews);
    const newCount = reviewCount + 1;
    setReviewCount(newCount);
    const totalRating =
      updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length;
    setAverageRating(totalRating);
    setShowForm(false);
  }

  return (
    <div>
      <RatingBreakdown reviews={reviews} averageRating={averageRating} reviewCount={reviewCount} />

      {/* Write a review button / form */}
      {canReview && !showForm && (
        <div className="mb-6">
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
            <MessageSquarePlus className="h-4 w-4" />
            Write a Review
          </Button>
        </div>
      )}

      {!isAuthenticated && authStatus !== 'loading' && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4 text-center dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <Link
              href="/auth/signin"
              className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Sign in
            </Link>{' '}
            to leave a review.
          </p>
        </div>
      )}

      {isAuthor && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4 text-center dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You cannot review your own extension.
          </p>
        </div>
      )}

      {hasReviewed && !isAuthor && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4 text-center dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You have already reviewed this extension.
          </p>
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <ReviewForm
            extensionId={extensionId}
            onSubmitted={handleReviewSubmitted}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Reviews list */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="py-12 text-center">
            <Star className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              No reviews yet. Be the first to review!
            </p>
          </div>
        ) : (
          reviews.map((review) => <ReviewCard key={review.id} review={review} />)
        )}
      </div>
    </div>
  );
}
