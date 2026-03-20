import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface MarketplacePaginationProps {
  pagination: PaginationInfo;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

const MarketplacePagination = React.memo(function MarketplacePagination({
  pagination,
  isLoading,
  onPageChange,
}: MarketplacePaginationProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-xp-border">
      <button
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={pagination.page <= 1 || isLoading}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-xp-border bg-xp-surface text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-3 w-3" />
        Previous
      </button>
      <span className="text-xs text-xp-text-muted">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <button
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={pagination.page >= pagination.totalPages || isLoading}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-xp-border bg-xp-surface text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
});

export default MarketplacePagination;
