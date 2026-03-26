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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session?.user) {
    router.push('/auth/signin');
    return null;
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped && dropped.name.endsWith('.zip')) {
        setFile(dropped);
      } else {
        setError('Please upload a .zip file');
      }
    },
    [],
  );

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
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Extension Submitted!</h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Your extension is pending review. We will notify you once it is approved.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Publish Extension</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Upload and submit your extension for review.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Extension Package (.zip)
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
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
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drag and drop your extension .zip here, or click to browse
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Maximum file size: 50MB
                </p>
              </>
            )}
          </div>
        </div>

        {/* Basic fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name (slug)
            </label>
            <input
              {...register('name')}
              placeholder="my-extension"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 dark:text-white"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <input
              {...register('displayName')}
              placeholder="My Extension"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 dark:text-white"
            />
            {errors.displayName && (
              <p className="text-xs text-red-500 mt-1">
                {errors.displayName.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="A brief description of your extension..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 dark:text-white resize-none [&::placeholder]:dark:text-gray-500"
          />
          {errors.description && (
            <p className="text-xs text-red-500 mt-1">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Version
            </label>
            <input
              {...register('version')}
              placeholder="1.0.0"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 dark:text-white"
            />
            {errors.version && (
              <p className="text-xs text-red-500 mt-1">
                {errors.version.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              License
            </label>
            <input
              {...register('licenseType')}
              placeholder="MIT"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
            <p className="text-xs text-red-500 mt-1">
              {errors.categories.message}
            </p>
          )}
        </div>

        {/* Pricing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Pricing
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="FREE"
                {...register('pricingType')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Free</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price (in cents, e.g., 499 = $4.99)
              </label>
              <input
                type="number"
                {...register('price', { valueAsNumber: true })}
                placeholder="499"
                className="w-48 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 dark:text-white"
              />
              {errors.price && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.price.message}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                You will need to set up Stripe Connect payouts in your dashboard
                to receive funds.
              </p>
            </div>
          )}
        </div>

        {/* Optional URLs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Repository URL (optional)
            </label>
            <input
              {...register('repositoryUrl')}
              placeholder="https://github.com/..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Homepage URL (optional)
            </label>
            <input
              {...register('homepageUrl')}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 rounded-lg text-sm">
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
