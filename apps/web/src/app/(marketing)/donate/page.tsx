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
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-500/10">
          <Heart className="h-8 w-8 text-pink-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Support Xplorer</h1>
        <p className="mx-auto mt-3 max-w-lg text-gray-500 dark:text-gray-400">
          Xplorer is free, open source, and built with love. Your sponsorship helps us cover
          infrastructure costs, fund development, and keep improving the project for everyone.
        </p>
      </div>

      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="rounded-2xl border border-gray-200 p-8 dark:border-gray-800">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            GitHub Sponsors
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Support us with a monthly sponsorship or a one-time donation directly through GitHub.
            Sponsors automatically get Pro access in Xplorer!
          </p>
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-6 py-3 font-medium text-white transition-colors hover:bg-pink-700"
          >
            <Heart className="h-5 w-5" />
            Sponsor on GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <p className="text-sm text-gray-400 dark:text-gray-500">
          Sponsoring through GitHub is the best way to support the project. All sponsors are
          recognized on our GitHub page.
        </p>
      </div>
    </div>
  );
}
