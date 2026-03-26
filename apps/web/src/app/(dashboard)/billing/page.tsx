'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  ArrowUpRight,
  CheckCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatPrice, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SPONSOR_URL = 'https://github.com/sponsors/kimlimjustin';

interface SubscriptionInfo {
  tier: 'FREE' | 'PRO';
  stripeConnectOnboarded: boolean;
}

interface PurchaseRecord {
  id: string;
  amount: number;
  currency: string;
  createdAt: string;
  extension: { displayName: string; slug: string };
}

export default function BillingPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (authStatus === 'authenticated') {
      fetchData();
    }
  }, [authStatus]);

  async function fetchData() {
    try {
      const res = await fetch('/api/user/subscription');
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
        setPurchases(data.purchases || []);
      }
    } catch {
      setError('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshSponsor() {
    setRefreshing(true);
    setRefreshMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/sponsors/check', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSubscription((prev) =>
          prev ? { ...prev, tier: data.subscriptionTier } : prev,
        );
        setRefreshMessage(
          data.isSponsor
            ? 'Sponsor status confirmed! You have Pro access.'
            : 'No active sponsorship found. Sponsor us on GitHub to unlock Pro!',
        );
      } else if (res.status === 429) {
        setError('Too many requests. Please try again in a minute.');
      } else {
        setError('Failed to check sponsor status.');
      }
    } catch {
      setError('Failed to check sponsor status.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleConnectSetup() {
    setActionLoading('connect');
    try {
      const res = await fetch('/api/billing/connect', { method: 'POST' });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch {
      setError('Failed to set up payouts');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
      {refreshMessage && (
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">{refreshMessage}</div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Manage your plan and extension author payouts.
        </p>
      </div>

      {/* Subscription card */}
      <div className="border border-gray-200 rounded-xl p-6 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h2>
          <Badge variant={subscription?.tier === 'PRO' ? 'brand' : 'default'}>
            {subscription?.tier || 'FREE'}
          </Badge>
        </div>

        {subscription?.tier === 'PRO' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Active — thank you for sponsoring Xplorer!
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your Pro access is linked to your GitHub Sponsors subscription.
              Manage it directly on GitHub.
            </p>
            <div className="flex gap-3">
              <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">
                  <ExternalLink className="h-4 w-4" />
                  Manage on GitHub
                </Button>
              </a>
              <Button
                variant="ghost"
                onClick={handleRefreshSponsor}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You are on the Free plan. Become a GitHub Sponsor to unlock Pro —
              unlimited extensions, reduced platform fees, and priority support.
            </p>
            <div className="flex gap-3">
              <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer">
                <Button>
                  <Heart className="h-4 w-4" />
                  Become a Sponsor
                </Button>
              </a>
              <Button
                variant="ghost"
                onClick={handleRefreshSponsor}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Already sponsoring? Click &quot;Refresh Status&quot; to sync your account.
              Status is also automatically checked each time you sign in.
            </p>
          </div>
        )}
      </div>

      {/* Connect for authors */}
      <div className="border border-gray-200 rounded-xl p-6 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
          Payouts (Extension Authors)
        </h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
          Set up Stripe Connect to receive payouts from paid extension sales.
        </p>

        {subscription?.stripeConnectOnboarded ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Stripe Connect is set up. You will receive payouts automatically.
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={handleConnectSetup}
            loading={actionLoading === 'connect'}
          >
            <ExternalLink className="h-4 w-4" />
            Set Up Payouts
          </Button>
        )}
      </div>

      {/* Purchase history */}
      <div className="border border-gray-200 rounded-xl p-6 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-white">
          Purchase History
        </h2>

        {purchases.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No purchases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:text-gray-400 dark:border-gray-800">
                  <th className="pb-2 font-medium">Extension</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-3 text-gray-900 font-medium dark:text-white">
                      {p.extension.displayName}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {formatPrice(p.amount)}
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">
                      {formatDate(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
