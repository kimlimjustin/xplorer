import { cn } from '@/lib/utils';

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        style,
        className,
      )}
    >
      {status}
    </span>
  );
}
