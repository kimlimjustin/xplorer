import type { Metadata } from 'next';
import { Heart } from 'lucide-react';
import { SITE_NAME } from '@/lib/constants';
import { PricingCards } from '@/components/billing/PricingCards';

const SPONSOR_URL = 'https://github.com/sponsors/kimlimjustin';

export const metadata: Metadata = {
  title: `Pricing | ${SITE_NAME}`,
  description: 'Xplorer pricing plans - Free and Pro tiers for individuals and power users.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500 dark:text-gray-400">
          Xplorer is free and open source. Become a GitHub Sponsor to unlock Pro — unlimited
          extensions, reduced fees, and priority support.
        </p>
      </div>

      {/* Pricing cards */}
      <PricingCards />

      {/* Donate section */}
      <div className="mt-24 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-500/10">
          <Heart className="h-7 w-7 text-pink-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Support the Project</h2>
        <p className="mx-auto mt-3 max-w-lg text-gray-500 dark:text-gray-400">
          Xplorer is built by a small team with passion. If you find it useful, consider sponsoring
          us on GitHub — even a one-time donation helps!
        </p>
        <a
          href={SPONSOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-pink-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-pink-700"
        >
          <Heart className="h-4 w-4" />
          Sponsor on GitHub
        </a>
      </div>
    </div>
  );
}
