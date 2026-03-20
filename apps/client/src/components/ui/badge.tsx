import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  className?: string;
  children: React.ReactNode;
}

export const Badge = ({ variant = 'default', className = '', children }: BadgeProps) => {
  const baseClasses =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    default: 'bg-blue-100 text-blue-900 hover:bg-blue-200',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    destructive: 'bg-red-100 text-red-900 hover:bg-red-200',
    outline: 'border border-gray-300 text-gray-900 hover:bg-gray-100',
    success: 'bg-green-100 text-green-900 hover:bg-green-200',
    warning: 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</span>
  );
}
