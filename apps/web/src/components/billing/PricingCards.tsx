import Link from 'next/link';
import { Check, X, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const SPONSOR_URL = 'https://github.com/sponsors/kimlimjustin';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  cta: string;
  href: string;
  external?: boolean;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Everything you need to get started with Xplorer.',
    features: [
      { text: 'Full desktop app', included: true },
      { text: 'All built-in features', included: true },
      { text: 'SSH remote access', included: true },
      { text: 'AI search (local Ollama)', included: true },
      { text: 'Install up to 20 extensions', included: true },
      { text: '30-min paid extension trials', included: true },
      { text: 'Publish extensions (30% platform fee)', included: true },
      { text: 'Unlimited extensions', included: false },
      { text: 'Reduced platform fee', included: false },
    ],
    cta: 'Get Started',
    href: '/docs/getting-started/installation',
  },
  {
    name: 'Pro',
    price: 'Sponsor',
    period: 'via GitHub',
    description: 'For power users and extension developers. Sponsor us on GitHub to unlock Pro.',
    features: [
      { text: 'Everything in Free', included: true },
      { text: 'Unlimited extension installs', included: true },
      { text: 'Full access to paid extensions', included: true },
      { text: 'Reduced platform fee (10%)', included: true },
      { text: 'Priority support', included: true },
      { text: 'Early access to new features', included: true },
      { text: 'Badge on marketplace profile', included: true },
      { text: 'All current features included', included: true },
      { text: 'Perpetual license', included: true },
    ],
    cta: 'Become a Sponsor',
    href: SPONSOR_URL,
    external: true,
    highlight: true,
  },
];

export function PricingCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {PLANS.map((plan) => (
        <div
          key={plan.name}
          className={cn(
            'rounded-2xl border p-8 flex flex-col',
            plan.highlight
              ? 'border-brand-300 shadow-lg shadow-brand-100 ring-1 ring-brand-200 dark:border-brand-500 dark:shadow-brand-900/20 dark:ring-brand-500/30'
              : 'border-gray-200 dark:border-gray-800',
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
          </div>

          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              {plan.price}
            </span>
            <span className="text-gray-500 dark:text-gray-400">{plan.period}</span>
          </div>

          <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">{plan.description}</p>

          <ul className="space-y-3 mb-8 flex-1">
            {plan.features.map((feat) => (
              <li key={feat.text} className="flex items-start gap-2.5">
                {feat.included ? (
                  <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <X className="h-5 w-5 text-gray-300 shrink-0 mt-0.5 dark:text-gray-600" />
                )}
                <span
                  className={cn(
                    'text-sm',
                    feat.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600',
                  )}
                >
                  {feat.text}
                </span>
              </li>
            ))}
          </ul>

          {plan.external ? (
            <a href={plan.href} target="_blank" rel="noopener noreferrer">
              <Button
                variant="primary"
                className="w-full"
                size="lg"
              >
                <Heart className="h-4 w-4" />
                {plan.cta}
              </Button>
            </a>
          ) : (
            <Link href={plan.href}>
              <Button
                variant="secondary"
                className="w-full"
                size="lg"
              >
                {plan.cta}
              </Button>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
