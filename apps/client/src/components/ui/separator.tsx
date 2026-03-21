import React from 'react';

interface SeparatorProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const Separator = ({ className = '', orientation = 'horizontal' }: SeparatorProps) => {
  return (
    <div
      className={`${
        orientation === 'horizontal' ? 'h-px w-full bg-gray-200' : 'h-full w-px bg-gray-200'
      } ${className}`}
    />
  );
};
