import Link from 'next/link';
import { SITE_NAME } from '@/lib/constants';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-7xl font-bold text-gray-200 dark:text-gray-800">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-gray-800 dark:text-white">
        Page Not Found
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 text-center max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/"
          className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          Back to Home
        </Link>
        <Link
          href="/docs"
          className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
        >
          Read the Docs
        </Link>
      </div>
    </div>
  );
}
