// Mock ScrollArea for web landing page
'use client';

import React from 'react';

export function ScrollArea({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} style={{ overflow: 'auto' }}>
      {children}
    </div>
  );
}
