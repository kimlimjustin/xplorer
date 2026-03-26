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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto dark:text-gray-400">
          Xplorer is free and open source. Become a GitHub Sponsor to unlock Pro —
          unlimited extensions, reduced fees, and priority support.
        </p>
      </div>

      {/* Pricing cards */}
      <PricingCards />

      {/* Donate section */}
      <div className="mt-24 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-pink-50 mb-4 dark:bg-pink-500/10">
          <Heart className="h-7 w-7 text-pink-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Support the Project
        </h2>
        <p className="mt-3 text-gray-500 max-w-lg mx-auto dark:text-gray-400">
          Xplorer is built by a small team with passion. If you find it useful,
          consider sponsoring us on GitHub — even a one-time donation helps!
        </p>
        <a
          href={SPONSOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors"
        >
          <Heart className="h-4 w-4" />
          Sponsor on GitHub
        </a>
      </div>
    </div>
  );
}
