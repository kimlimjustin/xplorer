import React, { useState, useEffect, useMemo } from 'react';

// Lazy-loaded sub-panels -- only loaded when the user switches to their tab
const TerminalPanelEnhanced = React.lazy(() => import('./TerminalPanelEnhanced'));
const UndoHistoryPanel = React.lazy(() => import('./UndoHistoryPanel'));
const NotificationCenter = React.lazy(() => import('./NotificationCenter'));
const ClipboardHistoryPanel = React.lazy(() => import('./ClipboardHistoryPanel'));
const ChangeReviewPanel = React.lazy(() => import('./ChangeReviewPanel'));
const ActivityFeedWrapper = React.lazy(() => import('./ActivityFeedWrapper'));
const PropertiesPanel = React.lazy(() => import('./PropertiesPanel'));
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useNotificationHistory } from '@/hooks/use-notification-history';
import type { ClipboardEntry } from '@/hooks/use-clipboard-history';
import type { FileChangeSet } from '@/hooks/use-focus-change-tracker';
import type { BottomPanelTabId } from '@/hooks/use-layout-state';
import { extensionHost } from '@/lib/extension-host';

type BottomPanelTab = BottomPanelTabId;

type ActivityLogFilter = 'all' | 'output' | 'activity' | 'history';

interface BottomPanelFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
}

interface BottomPanelProps {
  bottomPanelCollapsed: boolean;
  setBottomPanelCollapsed: (collapsed: boolean) => void;
  bottomPanelTab: BottomPanelTab;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  height?: number;
  terminalHistory: string[];
  terminalInput: string;
  setTerminalInput: (input: string) => void;
  terminalCwd: string;
  executeTerminalCommand: (command: string) => void;
  files: BottomPanelFileEntry[];
  currentPath: string;
  themes: Record<string, { name: string }>;
  theme: string;
  selectedFiles: Set<string>;
  selectedFile: BottomPanelFileEntry | null;
  outputMessages: string[];
  onNavigate?: (path: string) => void;
  onPasteFromHistory?: (entry: ClipboardEntry) => void;
  fileChanges?: FileChangeSet | null;
  onDismissChanges?: () => void;
  propertiesFilePath?: string;
}

/** Core (built-in) bottom panel tab IDs */
const CORE_TABS: BottomPanelTab[] = [
  'terminal',
  'activity-log',
  'changes',
  'clipboard',
  'notifications',
  'properties',
];

const BottomPanel = ({
  bottomPanelCollapsed,
  setBottomPanelCollapsed,
  bottomPanelTab,
  setBottomPanelTab,
  height,
  terminalHistory,
  terminalInput,
  setTerminalInput,
  terminalCwd,
  executeTerminalCommand,
  files,
  currentPath,
  themes,
  theme,
  selectedFiles,
  selectedFile,
  outputMessages,
  onNavigate,
  onPasteFromHistory,
  fileChanges,
  onDismissChanges,
  propertiesFilePath,
}: BottomPanelProps) => {
  const { unreadCount } = useNotificationHistory();
  const [activityLogFilter, setActivityLogFilter] = useState<ActivityLogFilter>('all');

  // Collect extension-registered bottom tabs
  const extensionBottomTabs = useMemo(() => {
    try {
      return extensionHost.getBottomTabs();
    } catch {
      return [];
    }
  }, []);

  // Listen for xplorer-set-bottom-tab events (dispatched by extensions/commands)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab) {
        setBottomPanelTab(detail.tab as BottomPanelTab);
      }
    };
    window.addEventListener('xplorer-set-bottom-tab', handler);
    return () => window.removeEventListener('xplorer-set-bottom-tab', handler);
  }, [setBottomPanelTab]);

  if (bottomPanelCollapsed) return null;

  // Check if the active tab is an extension tab
  const isExtensionTab = !CORE_TABS.includes(bottomPanelTab);

  const getTabLabel = (tab: BottomPanelTab): string => {
    if (tab === 'activity-log') return 'ACTIVITY LOG';
    if (tab === 'properties' && propertiesFilePath) {
      return `PROPERTIES: ${propertiesFilePath.replace(/^.*[\\/]/, '')}`;
    }
    // Extension tab label
    const extTab = extensionBottomTabs.find((bt) => bt.id === tab);
    if (extTab) return extTab.title;
    return tab.toUpperCase();
  };

  return (
    <div
      className="bg-xp-surface border-t border-xp-border flex flex-col flex-shrink-0"
      style={{ height: height ?? 192 }}
    >
      {/* Bottom Panel Tabs */}
      <div className="flex border-b border-xp-border" role="tablist" aria-label="Bottom panel tabs">
        {/* Core tabs */}
        {CORE_TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={bottomPanelTab === tab}
            aria-controls={`bottom-panel-${tab}`}
            id={`bottom-tab-${tab}`}
            onClick={() => setBottomPanelTab(tab)}
            className={`py-1.5 px-3 text-xs font-medium capitalize flex items-center gap-1.5 ${
              bottomPanelTab === tab
                ? 'bg-xp-bg border-b-2 border-xp-blue text-xp-blue'
                : 'hover:bg-xp-surface-light'
            }`}
          >
            {getTabLabel(tab)}
            {tab === 'changes' && fileChanges && fileChanges.totalCount > 0 && (
              <span className="bg-yellow-500/20 text-yellow-400 px-1 rounded text-[10px] font-bold ml-0.5">
                {fileChanges.totalCount}
              </span>
            )}
            {tab === 'notifications' && unreadCount > 0 && (
              <span className="bg-xp-blue/20 text-xp-blue px-1 rounded text-[10px] font-bold ml-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        ))}

        {/* Extension-provided bottom tabs */}
        {extensionBottomTabs.map((extTab) => (
          <button
            key={extTab.id}
            role="tab"
            aria-selected={bottomPanelTab === extTab.id}
            aria-controls={`bottom-panel-${extTab.id}`}
            id={`bottom-tab-${extTab.id}`}
            onClick={() => setBottomPanelTab(extTab.id as BottomPanelTab)}
            className={`py-1.5 px-3 text-xs font-medium flex items-center gap-1.5 ${
              bottomPanelTab === extTab.id
                ? 'bg-xp-bg border-b-2 border-xp-blue text-xp-blue'
                : 'hover:bg-xp-surface-light'
            }`}
          >
            {extTab.icon && <span className="w-3.5 h-3.5">{extTab.icon}</span>}
            {extTab.title}
          </button>
        ))}

        <button
          onClick={() => setBottomPanelCollapsed(true)}
          className="ml-auto px-2 hover:bg-xp-surface-light"
          title="Close (Ctrl+J)"
          aria-label="Close bottom panel"
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

      {/* Bottom Panel Content */}
      <div
        role="tabpanel"
        id={`bottom-panel-${bottomPanelTab}`}
        aria-labelledby={`bottom-tab-${bottomPanelTab}`}
        className="flex-1 overflow-y-auto"
      >
        <ErrorBoundary>
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-xs text-xp-text-muted">
                Loading...
              </div>
            }
          >
            {bottomPanelTab === 'terminal' && (
              <TerminalPanelEnhanced
                terminalHistory={terminalHistory}
                terminalInput={terminalInput}
                setTerminalInput={setTerminalInput}
                terminalCwd={terminalCwd}
                executeTerminalCommand={executeTerminalCommand}
                bottomPanelCollapsed={bottomPanelCollapsed}
                bottomPanelTab={bottomPanelTab}
              />
            )}

            {bottomPanelTab === 'activity-log' && (
              <ActivityLogContent
                activityLogFilter={activityLogFilter}
                setActivityLogFilter={setActivityLogFilter}
                outputMessages={outputMessages}
                files={files}
                currentPath={currentPath}
                themes={themes}
                theme={theme}
                terminalCwd={terminalCwd}
                selectedFiles={selectedFiles}
                selectedFile={selectedFile}
                onNavigate={onNavigate}
              />
            )}

            {bottomPanelTab === 'clipboard' && onPasteFromHistory && (
              <ClipboardHistoryPanel onPaste={onPasteFromHistory} />
            )}

            {bottomPanelTab === 'notifications' && <NotificationCenter />}

            {bottomPanelTab === 'changes' &&
              (fileChanges && fileChanges.totalCount > 0 ? (
                <ChangeReviewPanel
                  changes={fileChanges}
                  onDismiss={onDismissChanges ?? (() => {})}
                  onNavigate={onNavigate}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-xp-text-muted">
                  <svg
                    className="w-4 h-4 mr-2 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  No external file changes detected
                </div>
              ))}

            {bottomPanelTab === 'properties' && (
              <PropertiesPanel filePath={propertiesFilePath ?? ''} />
            )}
          </React.Suspense>

          {/* Extension bottom tab content */}
          {isExtensionTab &&
            (() => {
              const renderer = extensionHost.getBottomTabRenderer(bottomPanelTab);
              if (!renderer) return null;
              return renderer({ currentPath, isActive: true });
            })()}
        </ErrorBoundary>
      </div>
    </div>
  );
}

// ── Merged Activity Log content ─────────────────────────────────────────────

interface ActivityLogContentProps {
  activityLogFilter: ActivityLogFilter;
  setActivityLogFilter: (filter: ActivityLogFilter) => void;
  outputMessages: string[];
  files: BottomPanelFileEntry[];
  currentPath: string;
  themes: Record<string, { name: string }>;
  theme: string;
  terminalCwd: string;
  selectedFiles: Set<string>;
  selectedFile: BottomPanelFileEntry | null;
  onNavigate?: (path: string) => void;
}

const ACTIVITY_LOG_FILTERS: { value: ActivityLogFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'output', label: 'Output' },
  { value: 'activity', label: 'Activity' },
  { value: 'history', label: 'History' },
];

const ActivityLogContent = ({
  activityLogFilter,
  setActivityLogFilter,
  outputMessages,
  files,
  currentPath,
  themes,
  theme,
  terminalCwd,
  selectedFiles,
  selectedFile,
  onNavigate,
}: ActivityLogContentProps) => {
  return (
    <div className="flex flex-col h-full">
      {/* Sub-filter toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-xp-border bg-xp-surface-light/30 flex-shrink-0">
        {ACTIVITY_LOG_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActivityLogFilter(f.value)}
            className={`px-2 py-0.5 text-[10px] rounded font-medium ${
              activityLogFilter === f.value
                ? 'bg-xp-blue/20 text-xp-blue'
                : 'text-xp-text-muted hover:bg-xp-surface-light'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Output section */}
        {(activityLogFilter === 'all' || activityLogFilter === 'output') && (
          <div>
            {activityLogFilter === 'all' && (
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-xp-text-muted bg-xp-surface-light/20 border-b border-xp-border/50 sticky top-0 z-[1]">
                Output
              </div>
            )}
            <div className="text-xs space-y-1 p-3">
              {outputMessages.map((message, index) => (
                <div key={`${index}-${message.slice(0, 32)}`} className="text-xp-text-muted">
                  {message}
                </div>
              ))}
              <div className="text-xp-text-muted">
                [INFO] Loaded {files.length} files from {currentPath}
              </div>
              <div className="text-xp-text-muted">
                [INFO] Theme applied: {themes[theme]?.name}
              </div>
              <div className="text-xp-text-muted">
                [INFO] Terminal working directory: {terminalCwd}
              </div>
              {selectedFiles.size > 0 && (
                <div className="text-xp-blue">
                  [INFO] {selectedFiles.size} file(s) selected
                </div>
              )}
              {selectedFile && (
                <div className="text-xp-green">[INFO] Active file: {selectedFile.name}</div>
              )}
            </div>
          </div>
        )}

        {/* Activity section */}
        {(activityLogFilter === 'all' || activityLogFilter === 'activity') && (
          <div>
            {activityLogFilter === 'all' && (
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-xp-text-muted bg-xp-surface-light/20 border-b border-xp-border/50 sticky top-0 z-[1]">
                Activity
              </div>
            )}
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center h-16 text-xs text-xp-text-muted">
                  Loading...
                </div>
              }
            >
              <ActivityFeedWrapper onNavigate={onNavigate} />
            </React.Suspense>
          </div>
        )}

        {/* History section */}
        {(activityLogFilter === 'all' || activityLogFilter === 'history') && (
          <div>
            {activityLogFilter === 'all' && (
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-xp-text-muted bg-xp-surface-light/20 border-b border-xp-border/50 sticky top-0 z-[1]">
                History
              </div>
            )}
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center h-16 text-xs text-xp-text-muted">
                  Loading...
                </div>
              }
            >
              <UndoHistoryPanel />
            </React.Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

export default BottomPanel;
