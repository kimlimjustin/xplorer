import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type SortOption = 'popular' | 'recent' | 'rating';

interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
}

interface PaginationInfo {
  total: number;
}

interface MarketplaceFiltersProps {
  categories: MarketplaceCategory[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  pagination: PaginationInfo;
}

const SORT_LABELS: Record<SortOption, string> = {
  popular: 'Popular',
  recent: 'Recent',
  rating: 'Highest Rated',
};

const MarketplaceFilters = React.memo(function MarketplaceFilters({
  categories,
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy,
  pagination,
}: MarketplaceFiltersProps) {
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  return (
    <div className="px-3 py-2 border-b border-xp-border space-y-2">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              selectedCategory === ''
                ? 'bg-xp-blue text-white border-xp-blue'
                : 'bg-xp-surface border-xp-border text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                selectedCategory === cat.slug
                  ? 'bg-xp-blue text-white border-xp-blue'
                  : 'bg-xp-surface border-xp-border text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-xp-text-muted">
          {pagination.total} extension{pagination.total !== 1 ? 's' : ''}
        </span>
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-xp-border bg-xp-surface text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text transition-colors"
          >
            Sort: {SORT_LABELS[sortBy]}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showSortDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-xp-popover border border-xp-border rounded-md shadow-xl backdrop-blur-xl py-1 min-w-[140px]">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSortBy(option);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      sortBy === option
                        ? 'text-xp-blue bg-xp-blue/10'
                        : 'text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text'
                    }`}
                  >
                    {SORT_LABELS[option]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default MarketplaceFilters;
