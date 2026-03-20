import React, { useState } from 'react';

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs = ({ value, defaultValue, onValueChange, className = '', children }: TabsProps) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const currentValue = value !== undefined ? value : internalValue;

  const handleValueChange = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <div className={`${className}`} data-tabs-value={currentValue}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            currentValue,
            onValueChange: handleValueChange,
          } as Record<string, unknown>);
        }
        return child;
      })}
    </div>
  );
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
  currentValue?: string;
  onValueChange?: (value: string) => void;
}

export const TabsList = ({ className = '', children, currentValue, onValueChange }: TabsListProps) => {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 ${className}`}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            currentValue,
            onValueChange,
          } as Record<string, unknown>);
        }
        return child;
      })}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: React.ReactNode;
  currentValue?: string;
  onValueChange?: (value: string) => void;
}

export const TabsTrigger = ({
  value,
  className = '',
  children,
  currentValue,
  onValueChange,
}: TabsTriggerProps) => {
  const isActive = currentValue === value;

  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600 hover:text-gray-900'
      } ${className}`}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
  currentValue?: string;
}

export const TabsContent = ({ value, className = '', children, currentValue }: TabsContentProps) => {
  if (currentValue !== value) return null;

  return (
    <div
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  );
}
