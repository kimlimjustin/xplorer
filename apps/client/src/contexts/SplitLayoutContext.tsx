import React, { createContext, useContext } from 'react';
import { useSplitLayout, type SplitLayoutHook } from '@/hooks/use-split-layout';

const SplitLayoutContext = createContext<SplitLayoutHook | null>(null);

export const SplitLayoutProvider = ({ children }: { children: React.ReactNode }) => {
  const layout = useSplitLayout();
  return <SplitLayoutContext.Provider value={layout}>{children}</SplitLayoutContext.Provider>;
};

export const useSplitLayoutContext = (): SplitLayoutHook => {
  const ctx = useContext(SplitLayoutContext);
  if (!ctx) throw new Error('useSplitLayoutContext must be used within SplitLayoutProvider');
  return ctx;
};
