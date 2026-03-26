import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'brand' | 'green' | 'red' | 'yellow' | 'blue';
  className?: string;
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
