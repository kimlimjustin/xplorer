'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Something went wrong</h2>
      <p className="text-gray-600 dark:text-gray-400">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  );
}
