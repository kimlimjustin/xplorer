// Mock SmartSearch for web context
'use client';

import React, { forwardRef, useImperativeHandle } from 'react';
import { Search } from 'lucide-react';

export interface SmartSearchHandle {
  focusSearch: () => void;
  focus: () => void;
}

interface SmartSearchProps {
  currentPath: string;
  onFileSelect?: (filePath: string, isDir: boolean) => void;
  placeholder?: string;
  maxResults?: number;
}

const SmartSearch = forwardRef<SmartSearchHandle, SmartSearchProps>(
  function SmartSearch(_props, ref) {
    useImperativeHandle(ref, () => ({
      focusSearch: () => {},
      focus: () => {},
    }));

    return (
      <div className="flex items-center gap-1.5 rounded-md border border-xp-border bg-xp-surface-light px-2.5 py-1 text-xs text-xp-text-muted">
        <Search size={13} />
        <span className="whitespace-nowrap">Search</span>
      </div>
    );
  },
);

export default SmartSearch;
