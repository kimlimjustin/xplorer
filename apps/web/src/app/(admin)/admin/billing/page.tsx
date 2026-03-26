'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  DollarSign,
  ShoppingCart,
  Heart,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatPrice, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface RevenueStats {
  totalRevenue: number;
  totalPurchases: number;
  totalDonations: number;
  monthlyRevenue: number;
}

interface RecentTransaction {
  id: string;
  type: 'purchase' | 'donation';
  amount: number;
  currency: string;
  createdAt: string;
  userName?: string | null;
  extensionName?: string | null;
}

export default function AdminBillingPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (authStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }
      fetchRevenue();
    }
  }, [authStatus, session]);

  async function fetchRevenue() {
    try {
      const res = await fetch('/api/admin/billing');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setTransactions(data.transactions || []);
      }
    } catch {
      setError('Failed to load revenue data');
    } finally {
      setLoading(false);
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</div>}

      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue Dashboard</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Overview of platform revenue from purchases and donations.
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <RevenueStatCard
            icon={DollarSign}
            label="Total Revenue"
            value={formatPrice(stats.totalRevenue)}
            color="text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10"
          />
          <RevenueStatCard
            icon={ShoppingCart}
            label="Total Purchases"
            value={stats.totalPurchases.toString()}
            color="text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10"
          />
          <RevenueStatCard
            icon={Heart}
            label="Total Donations"
            value={stats.totalDonations.toString()}
            color="text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-500/10"
          />
          <RevenueStatCard
            icon={TrendingUp}
            label="This Month"
            value={formatPrice(stats.monthlyRevenue)}
            color="text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10"
          />
        </div>
      )}

      {/* Monthly chart placeholder */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Monthly Revenue
        </h2>
        <div className="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Chart visualization coming soon
          </p>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Recent Transactions
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Extension</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          tx.type === 'purchase'
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-pink-700 dark:text-pink-400'
                        }`}
                      >
                        {tx.type === 'purchase' ? (
                          <ShoppingCart className="h-3.5 w-3.5" />
                        ) : (
                          <Heart className="h-3.5 w-3.5" />
                        )}
                        {tx.type === 'purchase' ? 'Purchase' : 'Donation'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                      {tx.userName || 'Anonymous'}
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                      {tx.extensionName || '--'}
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                      {formatPrice(tx.amount)}
                    </td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                      {formatDate(tx.createdAt)}
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

function RevenueStatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5">
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg ${color} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
