import Link from 'next/link';
import { SITE_NAME } from '@/lib/constants';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="text-7xl font-bold text-gray-200 dark:text-gray-800">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-gray-800 dark:text-white">Page Not Found</h2>
      <p className="mt-2 max-w-md text-center text-gray-500 dark:text-gray-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-brand-700"
        >
          Back to Home
        </Link>
        <Link
          href="/docs"
          className="rounded-lg border border-gray-300 px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Read the Docs
        </Link>
      </div>
    </div>
  );
}
