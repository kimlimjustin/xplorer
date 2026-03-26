'use client';

import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface ReviewFormProps {
  extensionId: string;
  onSubmitted?: (review: any) => void;
  onCancel?: () => void;
}

export function ReviewForm({
  extensionId,
  onSubmitted,
  onCancel,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError('Please select a rating.');
      return;
    }

    if (content.length < 10) {
      setError('Review must be at least 10 characters.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/extensions/${extensionId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          title: title.trim() || undefined,
          content: content.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit review.');
        return;
      }

      const review = await res.json();
      onSubmitted?.(review);
    } catch {
      setError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoverRating || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 rounded-xl p-6 dark:border-gray-800"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Write a Review
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close review form"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Star rating selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
          Rating
        </label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5 transition-transform hover:scale-110"
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                className={cn(
                  'h-7 w-7 transition-colors',
                  star <= displayRating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
                )}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              {rating} of 5
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <label
          htmlFor="review-title"
          className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
        >
          Title{' '}
          <span className="text-gray-400 font-normal dark:text-gray-500">
            (optional)
          </span>
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={128}
          placeholder="Summarize your experience"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Content */}
      <div className="mb-4">
        <label
          htmlFor="review-content"
          className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
        >
          Review
        </label>
        <textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          minLength={10}
          maxLength={5000}
          rows={4}
          placeholder="Share your experience with this extension..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {content.length}/5000 characters (minimum 10)
        </p>
      </div>

      <div className="flex items-center gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" loading={submitting}>
          Submit Review
        </Button>
      </div>
    </form>
  );
}
