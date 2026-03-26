// Mock Dialog components for web landing page
'use client';

import React from 'react';

export function Dialog({ children, open }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  if (!open) return null;
  return <>{children}</>;
}

export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={className}>{children}</h2>;
}

export function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}
