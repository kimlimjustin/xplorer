'use client';

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { ExtensionCard, type ExtensionCardData } from './ExtensionCard';
import { ExtensionListItem } from './ExtensionListItem';
import { CategoryFilter } from './CategoryFilter';

interface ExtensionBrowserProps {
  extensions: ExtensionCardData[];
  categories: { id: string; name: string; slug: string }[];
}

type SortOption = 'popular' | 'newest' | 'rating' | 'downloads' | 'name';
type ViewMode = 'grid' | 'list';

const PAGE_SIZE = 12;

export function ExtensionBrowser({
  extensions,
  categories,
}: ExtensionBrowserProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('popular');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = extensions;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (ext) =>
          ext.displayName.toLowerCase().includes(q) ||
          ext.description.toLowerCase().includes(q) ||
          (ext.author.username ?? '').toLowerCase().includes(q),
      );
    }

    if (selectedCategory) {
      result = result.filter((ext) =>
        ext.categories.some((c) => c.category.slug === selectedCategory),
      );
    }

    switch (sort) {
      case 'popular':
        result = [...result].sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      case 'newest':
        break;
      case 'rating':
        result = [...result].sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'downloads':
        result = [...result].sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      case 'name':
        result = [...result].sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        );
        break;
    }

    return result;
  }, [extensions, search, selectedCategory, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleCategoryChange(slug: string | null) {
    setSelectedCategory(slug);
    setPage(1);
  }

  function handleSortChange(value: SortOption) {
    setSort(value);
    setPage(1);
  }

  return (
    <div>
      {/* Search and controls row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search extensions..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-800 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-white"
          >
            <option value="popular">Most Popular</option>
            <option value="newest">Newest</option>
            <option value="rating">Highest Rated</option>
            <option value="downloads">Most Downloaded</option>
            <option value="name">Name A-Z</option>
          </select>

          <div className="flex border border-gray-200 rounded-lg overflow-hidden dark:border-gray-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300'
              }`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="mb-6">
        <CategoryFilter
          categories={categories}
          selected={selectedCategory}
          onChange={handleCategoryChange}
        />
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {filtered.length} {filtered.length === 1 ? 'extension' : 'extensions'} found
        </p>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl dark:border-gray-800">
          <Search className="h-10 w-10 text-gray-300 mx-auto mb-3 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">No extensions found matching your search.</p>
          {(search || selectedCategory) && (
            <button
              onClick={() => { setSearch(''); setSelectedCategory(null); setPage(1); }}
              className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium dark:text-brand-400 dark:hover:text-brand-300"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((ext) => (
            <ExtensionCard key={ext.id} extension={ext} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((ext) => (
            <ExtensionListItem key={ext.id} extension={ext} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (totalPages <= 7) return true;
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - safePage) <= 1) return true;
                return false;
              })
              .reduce<(number | 'gap')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) {
                  acc.push('gap');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === 'gap' ? (
                  <span key={`gap-${i}`} className="px-2 text-gray-400 dark:text-gray-600">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
                      item === safePage
                        ? 'bg-brand-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
