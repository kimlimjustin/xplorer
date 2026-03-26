import type { Metadata } from 'next';
import { Heart, ExternalLink } from 'lucide-react';
import { SITE_NAME } from '@/lib/constants';

const SPONSOR_URL = 'https://github.com/sponsors/kimlimjustin';

export const metadata: Metadata = {
  title: `Support Xplorer | ${SITE_NAME}`,
  description: 'Support Xplorer development by becoming a GitHub Sponsor.',
};

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-pink-50 mb-4 dark:bg-pink-500/10">
          <Heart className="h-8 w-8 text-pink-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Support Xplorer
        </h1>
        <p className="mt-3 text-gray-500 max-w-lg mx-auto dark:text-gray-400">
          Xplorer is free, open source, and built with love. Your sponsorship helps
          us cover infrastructure costs, fund development, and keep improving the
          project for everyone.
        </p>
      </div>

      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="rounded-2xl border border-gray-200 p-8 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 dark:text-white">
            GitHub Sponsors
          </h2>
          <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
            Support us with a monthly sponsorship or a one-time donation directly
            through GitHub. Sponsors automatically get Pro access in Xplorer!
          </p>
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors"
          >
            <Heart className="h-5 w-5" />
            Sponsor on GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <p className="text-sm text-gray-400 dark:text-gray-500">
          Sponsoring through GitHub is the best way to support the project.
          All sponsors are recognized on our GitHub page.
        </p>
      </div>
    </div>
  );
}
