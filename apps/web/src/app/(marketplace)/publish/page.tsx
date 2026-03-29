'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { publishExtensionSchema, type PublishExtensionInput } from '@/lib/validation';
import { EXTENSION_CATEGORIES } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

export default function PublishPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PublishExtensionInput>({
    resolver: zodResolver(publishExtensionSchema),
    defaultValues: {
      pricingType: 'FREE',
      minimumXplorerVersion: '0.1.0',
      licenseType: 'MIT',
      currency: 'usd',
      categories: [],
    },
  });

  const pricingType = watch('pricingType');
  const selectedCategories = watch('categories');

  // Redirect if not authenticated
  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session?.user) {
    router.push('/auth/signin');
    return null;
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.zip')) {
      setFile(dropped);
    } else {
      setError('Please upload a .zip file');
    }
  }, []);

  const onSubmit = async (data: PublishExtensionInput) => {
    if (!file) {
      setError('Please upload an extension file');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('data', JSON.stringify(data));

      const res = await fetch('/api/extensions/publish', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to publish extension');
      }

      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    const current = selectedCategories || [];
    if (current.includes(cat)) {
      setValue(
        'categories',
        current.filter((c) => c !== cat),
      );
    } else if (current.length < 3) {
      setValue('categories', [...current, cat]);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Extension Submitted!</h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Your extension is pending review. We will notify you once it is approved.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Publish Extension</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Upload and submit your extension for review.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        {/* File upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Extension Package (.zip)
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                : file
                  ? 'border-green-300 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10'
                  : 'border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.zip';
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) setFile(f);
              };
              input.click();
            }}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <Package className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drag and drop your extension .zip here, or click to browse
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Maximum file size: 50MB
                </p>
              </>
            )}
          </div>
        </div>

        {/* Basic fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name (slug)
            </label>
            <input
              {...register('name')}
              placeholder="my-extension"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Display Name
            </label>
            <input
              {...register('displayName')}
              placeholder="My Extension"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            {errors.displayName && (
              <p className="mt-1 text-xs text-red-500">{errors.displayName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="A brief description of your extension..."
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white [&::placeholder]:dark:text-gray-500"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Version
            </label>
            <input
              {...register('version')}
              placeholder="1.0.0"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            {errors.version && (
              <p className="mt-1 text-xs text-red-500">{errors.version.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              License
            </label>
            <input
              {...register('licenseType')}
              placeholder="MIT"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Categories */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Categories (up to 3)
          </label>
          <div className="flex flex-wrap gap-2">
            {EXTENSION_CATEGORIES.map((cat) => {
              const isSelected = selectedCategories?.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          {errors.categories && (
            <p className="mt-1 text-xs text-red-500">{errors.categories.message}</p>
          )}
        </div>

        {/* Pricing */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Pricing
          </label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                value="FREE"
                {...register('pricingType')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Free</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                value="PAID"
                {...register('pricingType')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Paid</span>
            </label>
          </div>

          {pricingType === 'PAID' && (
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Price (in cents, e.g., 499 = $4.99)
              </label>
              <input
                type="number"
                {...register('price', { valueAsNumber: true })}
                placeholder="499"
                className="w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                You will need to set up Stripe Connect payouts in your dashboard to receive funds.
              </p>
            </div>
          )}
        </div>

        {/* Optional URLs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Repository URL (optional)
            </label>
            <input
              {...register('repositoryUrl')}
              placeholder="https://github.com/..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Homepage URL (optional)
            </label>
            <input
              {...register('homepageUrl')}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Submit for Review
        </Button>
      </form>
    </div>
  );
}
