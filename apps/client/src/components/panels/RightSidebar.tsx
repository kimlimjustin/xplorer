import React, { useRef, useState, useMemo, useLayoutEffect, useEffect, useCallback } from 'react';
import ExtensionPanelHost from './ExtensionPanelHost';
import PreviewNavigationBar from './PreviewNavigationBar';
import { extensionHost } from '@/lib/extension-host';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FileEntry, FolderSizeInfo } from '@/lib/tauri-api';
import { usePreviewHistory } from '@/hooks/use-preview-history';

// Lazy-loaded panels -- only loaded when the user switches to their tab
const PreviewPanel = React.lazy(() => import('./PreviewPanel'));
const TokenizerStatusPanel = React.lazy(() => import('./TokenizerStatusPanel'));
const ExtensionsPanel = React.lazy(() => import('./ExtensionsPanel'));
const MarketplacePanel = React.lazy(() => import('./MarketplacePanel'));
const PerformanceDashboard = React.lazy(() => import('./PerformanceDashboard'));
const ComparePreview = React.lazy(() => import('@/components/previews/ComparePreview'));

interface Theme {
  name: string;
  primary: string;
  bg: string;
  surface: string;
  text: string;
}

interface RightSidebarProps {
  rightSidebarCollapsed: boolean;
  setRightSidebarCollapsed: (collapsed: boolean) => void;
  rightPanelTab: string;
  width?: number;
  selectedFile: FileEntry | null;
  formatFileSize: (bytes: number) => string;
  formatDate: (timestamp: number) => string;
  themes: Record<string, Theme>;
  theme: string;
  applyTheme: (themeKey: string) => void;
  allFiles: FileEntry[];
  selectedFiles?: Set<string>;
  getFolderSize?: (path: string) => FolderSizeInfo | null;
  isCalculatingSize?: (path: string) => boolean;
  currentPath: string;
  navigateToPath?: (path: string) => void;
}

const RightSidebar = ({
  rightSidebarCollapsed,
  setRightSidebarCollapsed,
  rightPanelTab,
  width,
  selectedFile,
  formatFileSize,
  formatDate,
  themes,
  theme,
  applyTheme,
  allFiles,
  selectedFiles,
  getFolderSize,
  isCalculatingSize,
  currentPath,
  navigateToPath,
}: RightSidebarProps) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const panelContentRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);
  const [compareDismissed, setCompareDismissed] = useState(false);

  // ── Preview scrubber state ──────────────────────────────────────────────────
  const [previewIndex, setPreviewIndex] = useState(0);
  const [scrubberCompareMode, setScrubberCompareMode] = useState(false);
  const { getHistory, addToHistory, versionRef } = usePreviewHistory();
  // Force re-render counter so the Recent dropdown can re-read history
  const [historyVersion, setHistoryVersion] = useState(0);

  // Build ordered list of selected FileEntry objects for the scrubber
  const selectedFileEntries = useMemo<FileEntry[]>(() => {
    if (!selectedFiles || selectedFiles.size <= 1) return [];
    const fileMap = new Map(allFiles.map((f) => [f.path, f]));
    const entries: FileEntry[] = [];
    for (const path of selectedFiles) {
      const fe = fileMap.get(path);
      if (fe) entries.push(fe);
    }
    return entries;
  }, [selectedFiles, allFiles]);

  const multiSelected = selectedFileEntries.length > 1;
  const isPreviewTab = rightPanelTab === 'preview';

  // Clamp previewIndex when selection changes
  useEffect(() => {
    if (multiSelected) {
      setPreviewIndex((prev) => Math.min(prev, selectedFileEntries.length - 1));
    } else {
      setPreviewIndex(0);
    }
  }, [selectedFileEntries.length, multiSelected]);

  // Reset scrubber compare mode when selection changes
  const prevSelectionKey = useRef('');
  const selectionKey = selectedFiles ? Array.from(selectedFiles).sort().join('|') : '';
  if (selectionKey !== prevSelectionKey.current) {
    prevSelectionKey.current = selectionKey;
    if (scrubberCompareMode) setScrubberCompareMode(false);
  }

  // Determine the file to preview: when multi-select scrubber is active, use scrubber index
  const scrubberFile =
    multiSelected && isPreviewTab ? (selectedFileEntries[previewIndex] ?? null) : null;

  // The effective file for the preview panel
  const effectivePreviewFile = scrubberFile ?? selectedFile;

  // Track previewed files in history
  useEffect(() => {
    if (effectivePreviewFile && isPreviewTab) {
      addToHistory(effectivePreviewFile);
      setHistoryVersion(versionRef.current);
    }
    // effectivePreviewFile?.path is sufficient; versionRef is a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePreviewFile?.path, isPreviewTab, addToHistory]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!multiSelected || !isPreviewTab || rightSidebarCollapsed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when the panel or its children are focused
      const panel = panelContentRef.current;
      if (!panel) return;
      // Check if focus is within the right sidebar panel, or if nothing specific is focused
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement;
      if (isInputFocused) return;

      const total = selectedFileEntries.length;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Check if inside the right sidebar
        if (!panel.contains(activeEl) && activeEl !== document.body) return;

        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Left/Right: jump to first/last
          setPreviewIndex(e.key === 'ArrowLeft' ? 0 : total - 1);
        } else {
          setPreviewIndex((prev) => {
            if (e.key === 'ArrowLeft') return Math.max(0, prev - 1);
            return Math.min(total - 1, prev + 1);
          });
        }
      } else if (e.key === 'Enter') {
        if (!panel.contains(activeEl) && activeEl !== document.body) return;
        // Open the previewed file
        const file = selectedFileEntries[previewIndex];
        if (file) {
          import('@/lib/tauri-api').then(({ TauriAPI }) => {
            TauriAPI.openFile(file.path).catch(console.error);
          });
        }
      } else if (e.key === ' ') {
        if (!panel.contains(activeEl) && activeEl !== document.body) return;
        // Space: toggle file selection is handled by the grid, skip here
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [multiSelected, isPreviewTab, rightSidebarCollapsed, selectedFileEntries, previewIndex]);

  // ── Compare mode for scrubber ──────────────────────────────────────────────
  const scrubberCompareFiles = useMemo<[FileEntry, FileEntry] | null>(() => {
    if (!scrubberCompareMode || !multiSelected || previewIndex === 0) return null;
    const prev = selectedFileEntries[previewIndex - 1];
    const curr = selectedFileEntries[previewIndex];
    if (prev && curr) return [prev, curr];
    return null;
  }, [scrubberCompareMode, multiSelected, previewIndex, selectedFileEntries]);

  // ── Original 2-file compare logic ──────────────────────────────────────────
  const compareFiles = useMemo<[FileEntry, FileEntry] | null>(() => {
    if (!selectedFiles || selectedFiles.size !== 2) return null;
    const paths = Array.from(selectedFiles);
    const fileMap = new Map(allFiles.map((f) => [f.path, f]));
    const left = fileMap.get(paths[0]);
    const right = fileMap.get(paths[1]);
    if (left && right) return [left, right];
    return null;
  }, [selectedFiles, allFiles]);

  // Reset dismissed state when selection changes away from 2 files
  const prevCompareKey = useRef<string>('');
  const compareKey = compareFiles ? `${compareFiles[0].path}|${compareFiles[1].path}` : '';
  if (compareKey !== prevCompareKey.current) {
    prevCompareKey.current = compareKey;
    if (compareDismissed) setCompareDismissed(false);
  }

  // Whether to show the original compare mode (only when NOT using scrubber compare)
  const showCompare =
    rightPanelTab === 'preview' &&
    compareFiles !== null &&
    !compareDismissed &&
    !scrubberCompareMode;

  // Measure the actual rendered height of the outer div (set by flex cross-axis stretch)
  useLayoutEffect(() => {
    if (rightSidebarCollapsed) return;
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.clientHeight;
      if (h > 0) setMeasuredHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rightSidebarCollapsed]);

  // ── History select handler ─────────────────────────────────────────────────
  const handleHistorySelect = useCallback(
    (file: FileEntry) => {
      // Navigate to the file's parent directory and ensure it shows in preview
      if (navigateToPath) {
        const separator = file.path.includes('\\') ? '\\' : '/';
        const parentDir = file.path.substring(0, file.path.lastIndexOf(separator));
        if (parentDir) {
          navigateToPath(parentDir);
        }
      }
    },
    [navigateToPath],
  );

  if (rightSidebarCollapsed) return null;

  // Show scrubber navigation bar?
  const showScrubber = isPreviewTab && multiSelected && !showCompare;

  // Props bag passed to extension panels (for any extension that uses PanelRenderProps)
  const extensionProps = {
    selectedFile: showScrubber ? effectivePreviewFile : selectedFile,
    formatFileSize,
    formatDate,
    allFiles,
    selectedFiles,
    getFolderSize,
    isCalculatingSize,
    currentPath,
    navigateToPath,
  };

  // Get panel title for header
  const getTabTitle = () => {
    if (showCompare) return 'Compare Files';
    if (scrubberCompareFiles) return 'Compare Files';
    if (rightPanelTab === 'preview') return 'File Preview';
    if (rightPanelTab === 'tokenizer') return 'Content Search';
    if (rightPanelTab === 'performance') return 'Performance';
    if (rightPanelTab === 'extensions') return 'Extensions';
    if (rightPanelTab === 'marketplace') return 'Marketplace';
    const panel = extensionHost.getPanel(rightPanelTab);
    if (panel) return panel.title;
    return rightPanelTab;
  };

  return (
    <div
      ref={outerRef}
      className="bg-xp-surface border-l border-xp-border"
      style={{ width: width ?? 320, flexShrink: 0, minHeight: 0, overflow: 'hidden' }}
    >
      {/* Inner container with explicit measured height -- bypasses WebView2 flex height bug */}
      <div
        style={{
          height: measuredHeight || '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Right Panel Header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-xp-border"
          style={{ flexShrink: 0 }}
        >
          <h3 className="text-sm font-medium truncate">{getTabTitle()}</h3>
          <button
            onClick={() => setRightSidebarCollapsed(true)}
            className="p-1 hover:bg-xp-surface-light rounded flex-shrink-0 ml-2"
            aria-label="Close panel"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Preview scrubber navigation bar (multi-select only) */}
        {showScrubber && (
          <PreviewNavigationBar
            files={selectedFileEntries}
            currentIndex={previewIndex}
            onIndexChange={setPreviewIndex}
            getHistory={getHistory}
            historyVersion={historyVersion}
            onHistorySelect={handleHistorySelect}
            compareMode={scrubberCompareMode}
            onCompareToggle={() => setScrubberCompareMode((v) => !v)}
            showCompareToggle={selectedFileEntries.length >= 2 && previewIndex > 0}
          />
        )}

        {/* Panel content */}
        <div
          ref={panelContentRef}
          tabIndex={-1}
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            outline: 'none',
          }}
        >
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center text-xp-text-secondary text-xs">Loading...</div>}>
            {scrubberCompareFiles ? (
              <ErrorBoundary>
                <ComparePreview
                  leftFile={scrubberCompareFiles[0]}
                  rightFile={scrubberCompareFiles[1]}
                  onDismiss={() => setScrubberCompareMode(false)}
                  formatFileSize={formatFileSize}
                  formatDate={formatDate}
                />
              </ErrorBoundary>
            ) : showCompare && compareFiles ? (
              <ErrorBoundary>
                <ComparePreview
                  leftFile={compareFiles[0]}
                  rightFile={compareFiles[1]}
                  onDismiss={() => setCompareDismissed(true)}
                  formatFileSize={formatFileSize}
                  formatDate={formatDate}
                />
              </ErrorBoundary>
            ) : rightPanelTab === 'preview' ? (
              <ErrorBoundary>
                <PreviewPanel
                  selectedFile={showScrubber ? effectivePreviewFile : selectedFile}
                  formatFileSize={formatFileSize}
                  formatDate={formatDate}
                  getFolderSize={getFolderSize}
                  isCalculatingSize={isCalculatingSize}
                  currentPath={currentPath}
                />
              </ErrorBoundary>
            ) : rightPanelTab === 'tokenizer' ? (
              <ErrorBoundary>
                <TokenizerStatusPanel />
              </ErrorBoundary>
            ) : rightPanelTab === 'performance' ? (
              <ErrorBoundary>
                <PerformanceDashboard
                  currentPath={currentPath}
                  allFiles={allFiles}
                  navigateToPath={navigateToPath}
                />
              </ErrorBoundary>
            ) : rightPanelTab === 'extensions' ? (
              <ErrorBoundary>
                <ExtensionsPanel themes={themes} theme={theme} applyTheme={applyTheme} />
              </ErrorBoundary>
            ) : rightPanelTab === 'marketplace' ? (
              <ErrorBoundary>
                <MarketplacePanel />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary>
                <ExtensionPanelHost panelId={rightPanelTab} builtinProps={extensionProps} />
              </ErrorBoundary>
            )}
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}

export default RightSidebar;
