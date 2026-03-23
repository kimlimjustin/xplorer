import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileEntry } from '@/lib/tauri-api';
import { STORAGE_KEYS } from '@/lib/storage-keys';

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = string;

interface SmartViewResult {
  /** The suggested view mode (saved preference or auto-detected) */
  suggestedView: ViewMode;
  /** Save a view mode preference for the current folder */
  setSavedView: (mode: ViewMode) => void;
  /** Remove the saved preference for the current folder */
  clearSavedView: () => void;
  /** True if using auto-detection, false if the user has a saved preference */
  isAutoDetected: boolean;
}

// ── Persistence helpers ───────────────────────────────────────────────────────

const STORAGE_KEY = STORAGE_KEYS.SMART_VIEW;
const MAX_ENTRIES = 500;

const loadFolderViews = (): Record<string, ViewMode> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, ViewMode>;
      }
    }
  } catch (e) {
    console.warn('Failed to parse folder-views from localStorage:', e);
  }
  return {};
};

const getSavedViewMode = (path: string): ViewMode | null => {
  const saved = loadFolderViews();
  return saved[path] || null;
};

const saveViewMode = (path: string, mode: ViewMode): void => {
  const saved = loadFolderViews();
  saved[path] = mode;
  // Keep max entries (LRU eviction — drop oldest keys)
  const keys = Object.keys(saved);
  if (keys.length > MAX_ENTRIES) {
    delete saved[keys[0]];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
};

const removeSavedViewMode = (path: string): void => {
  const saved = loadFolderViews();
  delete saved[path];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
};

// ── Auto-detection logic ──────────────────────────────────────────────────────

const MEDIA_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.mp4',
  '.mov',
  '.avi',
  '.webm',
]);

const getExt = (name: string): string => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return name.slice(dotIndex).toLowerCase();
};

const detectOptimalView = (files: FileEntry[], _currentPath: string): ViewMode => {
  if (files.length === 0) return 'medium';

  // Gallery mode: if >60% of non-directory files are images/videos
  const nonDirFiles = files.filter((f) => !f.is_dir);
  const fileCount = nonDirFiles.length;
  if (fileCount > 0) {
    const mediaCount = nonDirFiles.filter((f) => MEDIA_EXTENSIONS.has(getExt(f.name))).length;
    if (mediaCount / fileCount > 0.6) return 'gallery';
  }

  // Details view: if >100 files (too many for grid)
  if (files.length > 100) return 'details';

  // Large icons: if mostly folders (like a home directory)
  const dirCount = files.filter((f) => f.is_dir).length;
  if (files.length > 0 && dirCount / files.length > 0.7) return 'large';

  // Default: medium icons
  return 'medium';
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useSmartView = (files: FileEntry[], currentPath: string): SmartViewResult => {
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [suggestedView, setSuggestedView] = useState<ViewMode>('medium');

  // Track whether user has manually set a view for the current path this session
  const userOverrodeRef = useRef(false);
  const prevPathRef = useRef(currentPath);

  // When path changes, re-evaluate
  useEffect(() => {
    if (prevPathRef.current !== currentPath) {
      userOverrodeRef.current = false;
      prevPathRef.current = currentPath;
    }

    // Skip auto-detection for special pages
    if (currentPath.startsWith('xplorer://') || currentPath.startsWith('gdrive://')) {
      setIsAutoDetected(false);
      setSuggestedView('medium');
      return;
    }

    // Priority 1: Saved user preference for this folder
    const saved = getSavedViewMode(currentPath);
    if (saved) {
      setSuggestedView(saved);
      setIsAutoDetected(false);
      return;
    }

    // Priority 2: Auto-detect based on contents (only when files are loaded)
    if (files.length > 0 && !userOverrodeRef.current) {
      const detected = detectOptimalView(files, currentPath);
      setSuggestedView(detected);
      setIsAutoDetected(true);
      return;
    }

    // Priority 3: Global default
    if (!userOverrodeRef.current) {
      setSuggestedView('medium');
      setIsAutoDetected(false);
    }
  }, [currentPath, files]);

  const setSavedView = useCallback(
    (mode: ViewMode) => {
      userOverrodeRef.current = true;
      saveViewMode(currentPath, mode);
      setSuggestedView(mode);
      setIsAutoDetected(false);
    },
    [currentPath],
  );

  const clearSavedView = useCallback(() => {
    removeSavedViewMode(currentPath);
    userOverrodeRef.current = false;
    // Re-detect
    if (files.length > 0) {
      const detected = detectOptimalView(files, currentPath);
      setSuggestedView(detected);
      setIsAutoDetected(true);
    } else {
      setSuggestedView('medium');
      setIsAutoDetected(false);
    }
  }, [currentPath, files]);

  return {
    suggestedView,
    setSavedView,
    clearSavedView,
    isAutoDetected,
  };
};
