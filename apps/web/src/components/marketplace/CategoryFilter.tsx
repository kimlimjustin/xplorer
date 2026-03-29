'use client';

import { cn } from '@/lib/utils';

export interface CategoryFilterProps {
  categories: { id: string; name: string; slug: string }[];
  selected: string | null;
  onChange: (slug: string | null) => void;
}

export function CategoryFilter({ categories, selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
          selected === null
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.slug === selected ? null : cat.slug)}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            selected === cat.slug
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
