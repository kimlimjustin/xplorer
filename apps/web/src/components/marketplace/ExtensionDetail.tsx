'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Download,
  ExternalLink,
  Github,
  Bug,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Monitor,
} from 'lucide-react';
import {
  cn,
  formatDownloadCount,
  formatDate,
  formatFileSize,
  formatPrice,
  safeImageUrl,
} from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PriceBadge } from './PriceBadge';
import { StarRating, type ReviewData } from './ReviewCard';
import { ReviewSection } from './ReviewSection';

interface ExtensionVersion {
  id: string;
  version: string;
  changeLog?: string | null;
  fileSize: number;
  createdAt: string;
  isLatest: boolean;
}

interface ExtensionDetailProps {
  extension: {
    id: string;
    slug: string;
    displayName: string;
    description: string;
    longDescription?: string | null;
    version: string;
    icon?: string | null;
    screenshots?: string | null;
    downloadCount: number;
    averageRating: number;
    reviewCount: number;
    fileSize: number;
    licenseType: string;
    repositoryUrl?: string | null;
    homepageUrl?: string | null;
    bugReportUrl?: string | null;
    publishedAt?: string | null;
    updatedAt: string;
    pricingType: string;
    price?: number | null;
    minimumXplorerVersion?: string;
    author: {
      name?: string | null;
      username?: string | null;
      image?: string | null;
    };
    categories: Array<{
      category?: { name: string; slug: string };
      name?: string;
      slug?: string;
    }>;
    versions: ExtensionVersion[];
    reviews: ReviewData[];
    [key: string]: unknown;
  };
}

type Tab = 'overview' | 'versions' | 'reviews';

function parseScreenshots(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (url: unknown) => typeof url === 'string' && safeImageUrl(url) !== '/placeholder-icon.png',
      );
    }
  } catch {
    // fall through
  }
  return [];
}

function ScreenshotGallery({ screenshots }: { screenshots: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (screenshots.length === 0) return null;

  return (
    <>
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Screenshots</h3>
        <div className="group relative">
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <button onClick={() => setLightboxOpen(true)} className="block w-full cursor-zoom-in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safeImageUrl(screenshots[activeIndex])}
                alt={`Screenshot ${activeIndex + 1}`}
                className="h-auto max-h-[420px] w-full bg-gray-50 object-contain dark:bg-gray-900"
              />
            </button>
          </div>
          {screenshots.length > 1 && (
            <>
              <button
                onClick={() =>
                  setActiveIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length)
                }
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition-opacity group-hover:opacity-100 dark:bg-gray-800/90"
                aria-label="Previous screenshot"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setActiveIndex((prev) => (prev + 1) % screenshots.length)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition-opacity group-hover:opacity-100 dark:bg-gray-800/90"
                aria-label="Next screenshot"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {screenshots.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {screenshots.map((url, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  'h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                  i === activeIndex
                    ? 'border-brand-500 ring-1 ring-brand-500/30'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={safeImageUrl(url)}
                  alt={`Thumbnail ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close lightbox"
          >
            <X className="h-5 w-5" />
          </button>
          {screenshots.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
                }}
                className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Previous screenshot"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) => (prev + 1) % screenshots.length);
                }}
                className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Next screenshot"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={safeImageUrl(screenshots[activeIndex])}
            alt={`Screenshot ${activeIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {screenshots.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(i);
                }}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/40',
                )}
                aria-label={`Go to screenshot ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function ExtensionDetail({ extension }: ExtensionDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const screenshots = parseScreenshots(extension.screenshots);
  const deepLink = `xplorer://extensions/install/${extension.slug}`;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'versions', label: 'Versions', count: extension.versions.length },
    { id: 'reviews', label: 'Reviews', count: extension.reviewCount },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href="/extensions"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 md:flex-row">
        <div className="flex flex-1 items-start gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-3xl font-bold text-brand-600 shadow-sm dark:from-brand-500/10 dark:to-brand-500/20">
            {extension.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeImageUrl(extension.icon)}
                alt={`${extension.displayName} icon`}
                className="h-14 w-14 rounded-xl"
              />
            ) : (
              extension.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                {extension.displayName}
              </h1>
              <PriceBadge pricingType={extension.pricingType} price={extension.price} />
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              by{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {extension.author.name || extension.author.username}
              </span>
              {extension.author.image && (
                <Image
                  src={extension.author.image}
                  alt=""
                  width={18}
                  height={18}
                  className="-mt-0.5 ml-1.5 inline-block rounded-full"
                />
              )}
            </p>
            <p className="mt-2 max-w-2xl leading-relaxed text-gray-600 dark:text-gray-400">
              {extension.description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                {formatDownloadCount(extension.downloadCount)} downloads
              </span>
              {extension.averageRating > 0 && (
                <span className="flex items-center gap-1.5">
                  <StarRating rating={Math.round(extension.averageRating)} size="sm" />
                  <span>
                    {extension.averageRating.toFixed(1)} ({extension.reviewCount})
                  </span>
                </span>
              )}
              {extension.categories.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {extension.categories.map((c: any) => (
                    <Link
                      key={c.category?.slug || c.slug}
                      href={`/extensions?category=${c.category?.slug || c.slug}`}
                    >
                      <Badge
                        variant="default"
                        className="cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        {c.category?.name || c.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <a href={deepLink}>
            <Button size="lg" className="w-full">
              <Monitor className="h-4 w-4" />
              {extension.pricingType === 'PAID' && extension.price
                ? `Buy for ${formatPrice(extension.price)}`
                : 'Install in Xplorer'}
            </Button>
          </a>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Opens in Xplorer desktop app
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
            <nav className="flex gap-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                      ({tab.count})
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div>
              {/* Screenshots */}
              <ScreenshotGallery screenshots={screenshots} />

              {/* Long description */}
              <div className="prose prose-sm prose-gray max-w-none dark:prose-invert">
                {extension.longDescription ? (
                  <div className="whitespace-pre-wrap">{extension.longDescription}</div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">
                    No detailed description available.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="space-y-3">
              {extension.versions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No version history available.</p>
              ) : (
                extension.versions.map((ver, idx) => (
                  <div
                    key={ver.id}
                    className={cn(
                      'rounded-xl border p-5 transition-colors',
                      idx === 0
                        ? 'border-brand-200 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/5'
                        : 'border-gray-200 dark:border-gray-800',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                        v{ver.version}
                      </span>
                      {ver.isLatest && <Badge variant="green">Latest</Badge>}
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {formatDate(ver.createdAt)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatFileSize(ver.fileSize)}
                      </span>
                    </div>
                    {ver.changeLog && (
                      <p className="mt-2.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                        {ver.changeLog}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <ReviewSection
              extensionId={extension.id}
              reviews={extension.reviews}
              averageRating={extension.averageRating}
              reviewCount={extension.reviewCount}
              authorUsername={extension.author.username}
            />
          )}
        </div>

        {/* Sidebar */}
        <aside className="shrink-0 space-y-4 lg:w-72">
          {/* Details card */}
          <div className="space-y-5 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Details
              </h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Version</dt>
                  <dd className="font-mono font-medium text-gray-900 dark:text-white">
                    {extension.version}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">License</dt>
                  <dd className="text-gray-900 dark:text-white">{extension.licenseType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Size</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {formatFileSize(extension.fileSize)}
                  </dd>
                </div>
                {extension.minimumXplorerVersion && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Requires</dt>
                    <dd className="text-gray-900 dark:text-white">
                      Xplorer {extension.minimumXplorerVersion}+
                    </dd>
                  </div>
                )}
                {extension.publishedAt && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Published</dt>
                    <dd className="text-gray-900 dark:text-white">
                      {formatDate(extension.publishedAt)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Updated</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {formatDate(extension.updatedAt)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Categories */}
            {extension.categories.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Categories
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {extension.categories.map((c: any) => (
                    <Link
                      key={c.category?.slug || c.slug}
                      href={`/extensions?category=${c.category?.slug || c.slug}`}
                    >
                      <Badge
                        variant="default"
                        className="cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        {c.category?.name || c.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Links
              </h3>
              <div className="space-y-2">
                {extension.repositoryUrl && (
                  <a
                    href={extension.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
                  >
                    <Github className="h-4 w-4" />
                    Repository
                  </a>
                )}
                {extension.homepageUrl && (
                  <a
                    href={extension.homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Homepage
                  </a>
                )}
                {extension.bugReportUrl && (
                  <a
                    href={extension.bugReportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
                  >
                    <Bug className="h-4 w-4" />
                    Report Bug
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats card */}
          <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Stats
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatDownloadCount(extension.downloadCount)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Downloads</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {extension.averageRating > 0 ? extension.averageRating.toFixed(1) : '--'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rating</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {extension.versions.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Versions</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {extension.reviewCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reviews</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
