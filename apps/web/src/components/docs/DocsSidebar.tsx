'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DOCS_SIDEBAR,
  type SidebarEntry,
  type SidebarItem,
  type SidebarCategory,
} from '@/lib/docs-sidebar';

function isSidebarCategory(entry: SidebarEntry): entry is SidebarCategory {
  return 'label' in entry;
}

function SidebarLink({ item }: { item: SidebarItem }) {
  const pathname = usePathname();
  const href = `/docs/${item.slug}`;
  const isActive = pathname === href || (pathname === '/docs' && item.slug === 'intro');

  return (
    <Link
      href={href}
      className={cn(
        'block px-3 py-1.5 text-sm rounded-md transition-colors',
        isActive
          ? 'bg-brand-50 text-brand-700 font-medium dark:bg-brand-500/10 dark:text-brand-400'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800',
      )}
    >
      {item.title}
    </Link>
  );
}

function CategorySection({ category }: { category: SidebarCategory }) {
  const pathname = usePathname();
  const isAnyActive = category.items.some(
    (item) => pathname === `/docs/${item.slug}`,
  );
  const [open, setOpen] = useState(isAnyActive);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 rounded-md transition-colors dark:text-white dark:hover:bg-gray-800"
      >
        {category.label}
        <ChevronRight
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform dark:text-gray-500',
            open && 'rotate-90',
          )}
        />
      </button>
      {open && (
        <div className="ml-2 mt-1 space-y-0.5 border-l border-gray-200 pl-2 dark:border-gray-800">
          {category.items.map((item) => (
            <SidebarLink key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DocsSidebar() {
  return (
    <nav className="space-y-1">
      {DOCS_SIDEBAR.map((entry, idx) =>
        isSidebarCategory(entry) ? (
          <CategorySection key={entry.label} category={entry} />
        ) : (
          <SidebarLink key={(entry as SidebarItem).slug} item={entry as SidebarItem} />
        ),
      )}
    </nav>
  );
}
