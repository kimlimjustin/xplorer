'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Download,
  Package,
  User,
  Calendar,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/marketplace/StatusBadge';
import { PriceBadge } from '@/components/marketplace/PriceBadge';
import { formatDate, formatFileSize, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface ExtensionReviewData {
  id: string;
  slug: string;
  displayName: string;
  name: string;
  description: string;
  longDescription?: string | null;
  version: string;
  status: string;
  fileSize: number;
  checksum: string;
  downloadUrl: string;
  licenseType: string;
  repositoryUrl?: string | null;
  pricingType: 'FREE' | 'PAID';
  price?: number | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name?: string | null;
    username: string;
    email?: string | null;
    image?: string | null;
  };
  categories: { category: { name: string } }[];
}

export default function AdminExtensionReviewPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const extensionId = params.id as string;

  const [extension, setExtension] = useState<ExtensionReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);

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
      fetchExtension();
    }
  }, [authStatus, session]);

  async function fetchExtension() {
    try {
      const res = await fetch(`/api/admin/extensions/${extensionId}`);
      if (res.ok) {
        const data = await res.json();
        setExtension(data);
      } else {
        setError('Extension not found');
      }
    } catch {
      setError('Failed to load extension');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'approve' | 'reject') {
    setActionLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/extensions/${extensionId}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        setActionDone(action);
        if (extension) {
          setExtension({
            ...extension,
            status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          });
        }
      } else {
        const body = await res.json();
        setError(body.error || `Failed to ${action} extension`);
      }
    } catch {
      setError(`Failed to ${action} extension`);
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

  if (error && !extension) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
        <Link href="/admin" className="mt-4 inline-block">
          <Button variant="secondary">Back to Admin</Button>
        </Link>
      </div>
    );
  }

  if (!extension) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {extension.displayName}
            </h1>
            <StatusBadge status={extension.status} />
            <PriceBadge pricingType={extension.pricingType} price={extension.price} />
          </div>
          <p className="mt-1 text-gray-500 dark:text-gray-400">{extension.description}</p>
        </div>

        {extension.status === 'PENDING' && !actionDone && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="primary"
              onClick={() => handleAction('approve')}
              loading={actionLoading === 'approve'}
              disabled={!!actionLoading}
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="danger"
              onClick={() => handleAction('reject')}
              loading={actionLoading === 'reject'}
              disabled={!!actionLoading}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        )}

        {actionDone && (
          <Badge variant={actionDone === 'approve' ? 'green' : 'red'}>
            {actionDone === 'approve' ? 'Approved' : 'Rejected'}
          </Badge>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 rounded-lg text-sm mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Extension Details</h2>
          <dl className="space-y-3 text-sm">
            <DetailRow icon={Package} label="Name" value={extension.name} />
            <DetailRow icon={FileText} label="Version" value={extension.version} />
            <DetailRow icon={FileText} label="License" value={extension.licenseType} />
            <DetailRow icon={Download} label="File Size" value={formatFileSize(extension.fileSize)} />
            <DetailRow icon={Calendar} label="Submitted" value={formatDate(extension.createdAt)} />
            {extension.pricingType === 'PAID' && extension.price && (
              <DetailRow icon={FileText} label="Price" value={formatPrice(extension.price)} />
            )}
          </dl>
          {extension.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {extension.categories.map((c) => (
                <Badge key={c.category.name} variant="default">
                  {c.category.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Author</h2>
          <dl className="space-y-3 text-sm">
            <DetailRow icon={User} label="Username" value={extension.author.username} />
            {extension.author.name && (
              <DetailRow icon={User} label="Name" value={extension.author.name} />
            )}
            {extension.author.email && (
              <DetailRow icon={FileText} label="Email" value={extension.author.email} />
            )}
          </dl>

          {extension.repositoryUrl && (
            <div className="pt-2">
              <a
                href={extension.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-600 hover:text-brand-700 underline"
              >
                View Repository
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Long description */}
      {extension.longDescription && (
        <div className="mt-6 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Long Description
          </h2>
          <div className="prose prose-sm prose-gray dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">
              {extension.longDescription}
            </p>
          </div>
        </div>
      )}

      {/* Checksum */}
      <div className="mt-6 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          File Integrity
        </h2>
        <p className="text-xs font-mono text-gray-500 dark:text-gray-400 break-all">
          SHA-256: {extension.checksum || 'N/A'}
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4" />
        {label}
      </dt>
      <dd className="font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}
