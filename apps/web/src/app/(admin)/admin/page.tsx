'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/marketplace/StatusBadge';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface AdminStats {
  totalUsers: number;
  totalExtensions: number;
  pendingExtensions: number;
  totalRevenue: number;
}

interface PendingExtension {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  version: string;
  status: string;
  createdAt: string;
  author: {
    name?: string | null;
    username: string;
  };
}

export default function AdminPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<PendingExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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
      fetchAdmin();
    }
  }, [authStatus, session]);

  async function fetchAdmin() {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setPending(data.pending || []);
      }
    } catch {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(extensionId: string, action: 'approve' | 'reject') {
    setActionLoading(extensionId);
    try {
      const res = await fetch(`/api/admin/extensions/${extensionId}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        setPending((prev) => prev.filter((ext) => ext.id !== extensionId));
        if (stats) {
          setStats({
            ...stats,
            pendingExtensions: stats.pendingExtensions - 1,
            ...(action === 'approve' ? { totalExtensions: stats.totalExtensions + 1 } : {}),
          });
        }
      }
    } catch {
      setError('Failed to process extension action');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <AdminStatCard
            icon={Users}
            label="Total Users"
            value={stats.totalUsers.toString()}
            color="text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10"
          />
          <AdminStatCard
            icon={Package}
            label="Published Extensions"
            value={stats.totalExtensions.toString()}
            color="text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10"
          />
          <AdminStatCard
            icon={Clock}
            label="Pending Review"
            value={stats.pendingExtensions.toString()}
            color="text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-500/10"
          />
          <AdminStatCard
            icon={DollarSign}
            label="Total Revenue"
            value={`$${(stats.totalRevenue / 100).toFixed(2)}`}
            color="text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10"
          />
        </div>
      )}

      {/* Navigation to sub-pages */}
      <div className="flex gap-3">
        <Link href="/admin/billing">
          <Button variant="secondary" size="sm">
            <DollarSign className="h-4 w-4" />
            Revenue Dashboard
          </Button>
        </Link>
      </div>

      {/* Pending extensions table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Pending Extensions
          </h2>
          <Badge variant="yellow">{pending.length} pending</Badge>
        </div>

        {pending.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-400" />
            <p className="text-gray-500 dark:text-gray-400">
              All caught up! No extensions pending review.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-6 py-3 font-medium">Extension</th>
                  <th className="px-6 py-3 font-medium">Author</th>
                  <th className="px-6 py-3 font-medium">Version</th>
                  <th className="px-6 py-3 font-medium">Submitted</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((ext) => (
                  <tr
                    key={ext.id}
                    className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                  >
                    <td className="px-6 py-3">
                      <div>
                        <Link
                          href={`/admin/extensions/${ext.id}`}
                          className="font-medium text-gray-900 hover:text-brand-600 dark:text-white"
                        >
                          {ext.displayName}
                        </Link>
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
                          {ext.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                      {ext.author.name || ext.author.username}
                    </td>
                    <td className="px-6 py-3 font-mono text-gray-600 dark:text-gray-400">
                      {ext.version}
                    </td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                      {formatDate(ext.createdAt)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/extensions/${ext.id}`}>
                          <Button variant="ghost" size="sm" aria-label="View extension">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAction(ext.id, 'approve')}
                          loading={actionLoading === ext.id}
                          disabled={!!actionLoading}
                          aria-label="Approve extension"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleAction(ext.id, 'reject')}
                          loading={actionLoading === ext.id}
                          disabled={!!actionLoading}
                          aria-label="Reject extension"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
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

function AdminStatCard({
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
    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
