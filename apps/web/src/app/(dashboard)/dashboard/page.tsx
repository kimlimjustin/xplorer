'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Download,
  Star,
  DollarSign,
  ExternalLink,
  Eye,
  Plus,
  TrendingUp,
  ArrowUpRight,
  Search,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/marketplace/StatusBadge';
import { PriceBadge } from '@/components/marketplace/PriceBadge';
import { formatDownloadCount, formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface DashboardExtension {
  id: string;
  slug: string;
  displayName: string;
  version: string;
  status: string;
  downloadCount: number;
  averageRating: number;
  reviewCount: number;
  pricingType: 'FREE' | 'PAID';
  price?: number | null;
  updatedAt: string;
  categories: Array<{ category: { name: string; slug: string } }>;
}

interface DashboardStats {
  totalExtensions: number;
  totalDownloads: number;
  averageRating: number;
  totalRevenue: number;
}

interface DownloadPoint {
  date: string;
  count: number;
}

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [extensions, setExtensions] = useState<DashboardExtension[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [downloadChart, setDownloadChart] = useState<DownloadPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (authStatus === 'authenticated') {
      fetchDashboard();
    }
  }, [authStatus]);

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/user/dashboard');
      if (res.ok) {
        const data = await res.json();
        setExtensions(data.extensions || []);
        setStats(data.stats || null);
        setDownloadChart(data.downloadChart || []);
      }
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  const filteredExtensions = useMemo(() => {
    if (!searchQuery) return extensions;
    const q = searchQuery.toLowerCase();
    return extensions.filter((ext) => ext.displayName.toLowerCase().includes(q));
  }, [extensions, searchQuery]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Manage your published extensions and track performance.
          </p>
        </div>
        <Link href="/publish">
          <Button>
            <Plus className="h-4 w-4" />
            Publish Extension
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Package}
            label="Extensions"
            value={stats.totalExtensions.toString()}
            color="text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-500/10"
          />
          <StatCard
            icon={Download}
            label="Total Downloads"
            value={formatDownloadCount(stats.totalDownloads)}
            color="text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10"
          />
          <StatCard
            icon={Star}
            label="Avg. Rating"
            value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '--'}
            color="text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-500/10"
          />
          <StatCard
            icon={DollarSign}
            label="Earnings"
            value={`$${(stats.totalRevenue / 100).toFixed(2)}`}
            subtitle={stats.totalRevenue > 0 ? 'Total payout' : undefined}
            color="text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10"
          />
        </div>
      )}

      {/* Download chart */}
      {downloadChart.length > 0 && stats && stats.totalDownloads > 0 && (
        <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Downloads (Last 30 Days)
              </h2>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {downloadChart.reduce((sum, d) => sum + d.count, 0)} total
            </span>
          </div>
          <MiniBarChart data={downloadChart} />
        </div>
      )}

      {/* Connect prompt */}
      {session?.user && <ConnectPrompt />}

      {/* Extensions table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Your Extensions</h2>
          {extensions.length > 3 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          )}
        </div>

        {extensions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              You have not published any extensions yet.
            </p>
            <Link href="/publish" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                <Plus className="h-4 w-4" />
                Publish Your First Extension
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-6 py-3 font-medium">Extension</th>
                  <th className="px-6 py-3 font-medium">Version</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Downloads</th>
                  <th className="px-6 py-3 font-medium">Rating</th>
                  <th className="px-6 py-3 font-medium">Updated</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredExtensions.map((ext) => (
                  <tr
                    key={ext.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {ext.displayName}
                        </div>
                        <PriceBadge pricingType={ext.pricingType} price={ext.price} />
                      </div>
                      {ext.categories.length > 0 && (
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                          {ext.categories.map((c) => c.category.name).join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-gray-600 dark:text-gray-400">
                      {ext.version}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={ext.status.toLowerCase()} />
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                        {formatDownloadCount(ext.downloadCount)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 dark:text-gray-400">
                      {ext.averageRating > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          {ext.averageRating.toFixed(1)}
                          <span className="text-gray-400 dark:text-gray-500">
                            ({ext.reviewCount})
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">--</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-gray-500 dark:text-gray-400">
                      {formatDate(ext.updatedAt)}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/extensions/${ext.slug}`}
                          className="text-gray-400 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                          aria-label="View extension"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/extensions/${ext.slug}`}
                          className="text-gray-400 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                          aria-label="Open extension page"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {searchQuery && filteredExtensions.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No extensions matching &quot;{searchQuery}&quot;
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-5 transition-shadow hover:shadow-sm dark:border-gray-800">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      {subtitle && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
    </div>
  );
}

function MiniBarChart({ data }: { data: DownloadPoint[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex h-24 items-end gap-[3px]">
      {data.map((d, i) => {
        const heightPct = Math.max((d.count / maxCount) * 100, 2);
        const label = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        return (
          <div key={d.date} className="group relative flex-1">
            <div
              className="w-full cursor-default rounded-t bg-brand-500/80 transition-colors hover:bg-brand-500"
              style={{ height: `${heightPct}%` }}
            />
            <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 group-hover:block">
              <div className="whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white dark:bg-gray-700">
                {d.count} downloads
                <br />
                {label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConnectPrompt() {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/user/subscription')
      .then((r) => r.json())
      .then((data) => {
        setConnected(data.subscription?.stripeConnectOnboarded ?? false);
      })
      .catch(() => setConnected(false));
  }, []);

  if (connected === null || connected) return null;

  async function handleSetup() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/connect', { method: 'POST' });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-yellow-200 bg-yellow-50 p-5 dark:border-yellow-500/30 dark:bg-yellow-500/10">
      <div>
        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
          Set up payouts to receive revenue from paid extensions
        </p>
        <p className="mt-0.5 text-sm text-yellow-700 dark:text-yellow-400">
          Connect your Stripe account to start receiving payments.
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={handleSetup} loading={loading}>
        <ExternalLink className="h-4 w-4" />
        Set Up Payouts
      </Button>
    </div>
  );
}
