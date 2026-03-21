import React, { createContext, useContext } from 'react';
import type { CrossTabSelectionState } from '@/hooks/use-cross-tab-selection';

const CrossTabSelectionContext = createContext<CrossTabSelectionState | null>(null);

export const CrossTabSelectionProvider = ({
  value,
  children,
}: {
  value: CrossTabSelectionState;
  children: React.ReactNode;
}) => {
  return (
    <CrossTabSelectionContext.Provider value={value}>{children}</CrossTabSelectionContext.Provider>
  );
};

export const useCrossTabSelectionContext = (): CrossTabSelectionState | null => {
  return useContext(CrossTabSelectionContext);
};
