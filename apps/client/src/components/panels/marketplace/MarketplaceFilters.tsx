import React, { useState, useEffect, useRef } from 'react';
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

const MarketplaceFilters = React.memo(
  ({
    categories,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    pagination,
  }: MarketplaceFiltersProps) => {
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const sortRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!showSortDropdown) return;
      const onMouseDown = (e: MouseEvent) => {
        if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
          setShowSortDropdown(false);
        }
      };
      document.addEventListener('mousedown', onMouseDown);
      return () => document.removeEventListener('mousedown', onMouseDown);
    }, [showSortDropdown]);

    return (
      <div className="border-xp-border space-y-2 border-b px-3 py-2">
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory('')}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selectedCategory === ''
                  ? 'bg-xp-blue border-xp-blue text-white'
                  : 'bg-xp-surface border-xp-border text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  selectedCategory === cat.slug
                    ? 'bg-xp-blue border-xp-blue text-white'
                    : 'bg-xp-surface border-xp-border text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xp-text-muted text-xs">
            {pagination.total} extension{pagination.total !== 1 ? 's' : ''}
          </span>
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="border-xp-border bg-xp-surface text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors"
            >
              Sort: {SORT_LABELS[sortBy]}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSortDropdown && (
              <>
                <div className="bg-xp-popover border-xp-border absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-md border py-1 shadow-xl backdrop-blur-xl">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortBy(option);
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
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
  },
);

export default MarketplaceFilters;
