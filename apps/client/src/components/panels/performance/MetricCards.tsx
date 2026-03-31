import React from 'react';
import { formatFileSize } from '@/lib/utils';
import type { CleanupSuggestion } from '@/hooks/use-performance-stats';
import {
  cardStyle,
  cardTitleStyle,
  smallBtnStyle,
  suggestionRowStyle,
  StatRow,
  ProgressBar,
  opColor,
  formatRelativeTime,
} from '../performance-dashboard-helpers';

// ── Types ────────────────────────────────────────────────────────────────────

interface DirectoryStats {
  fileCount: number;
  folderCount: number;
  totalSize: number;
  cachedFolderCount: number;
}

interface IndexingStatus {
  isAiProcessing: boolean;
  aiIndexed: number;
  aiQueueLength: number;
  currentAiFile?: string;
  isTokenizerIndexing: boolean;
  tokenTotalFiles: number;
  tokenTotalTokens: number;
  tokenLastUpdated: number;
}

interface RecentOp {
  id?: number | string;
  operation: string;
  success: boolean;
  paths: string[];
  timestamp: string;
  details?: string | null;
}

interface MetricCardsProps {
  directoryStats: DirectoryStats;
  indexingStatus: IndexingStatus;
  recentOps: RecentOp[];
  suggestions: CleanupSuggestion[];
  memoryUsage: number | null;
  isLoading: boolean;
  onRefresh: () => void;
  onReindex: () => void;
  onSuggestionAction: (s: CleanupSuggestion) => void;
}

// ── MetricCards Component ────────────────────────────────────────────────────

const MetricCards = ({
  directoryStats,
  indexingStatus,
  recentOps,
  suggestions,
  memoryUsage,
  isLoading,
  onRefresh,
  onReindex,
  onSuggestionAction,
}: MetricCardsProps) => {
  return (
    <div style={{ padding: '4px 12px 10px' }}>
      {/* Header with refresh */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            ...smallBtnStyle,
            opacity: isLoading ? 0.5 : 1,
          }}
          title="Refresh stats"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* System Stats Card */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>System Stats</div>
        <StatRow label="Files" value={directoryStats.fileCount.toLocaleString()} />
        <StatRow label="Folders" value={directoryStats.folderCount.toLocaleString()} />
        <StatRow label="Total Size" value={formatFileSize(directoryStats.totalSize)} />
        <StatRow label="Folders Cached" value={`${directoryStats.cachedFolderCount} folders`} />
        {memoryUsage !== null && (
          <StatRow label="JS Heap Usage" value={formatFileSize(memoryUsage)} />
        )}
      </div>

      {/* Indexing Status Card */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Indexing Status</div>

        {/* AI Indexer */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--xp-text-secondary)' }}>AI Indexer</span>
            <span
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 3,
                background: indexingStatus.isAiProcessing
                  ? 'rgba(59, 130, 246, 0.2)'
                  : 'rgba(34, 197, 94, 0.15)',
                color: indexingStatus.isAiProcessing ? '#60a5fa' : '#4ade80',
              }}
            >
              {indexingStatus.isAiProcessing ? 'Indexing' : 'Idle'}
            </span>
          </div>
          <StatRow label="Indexed Files" value={indexingStatus.aiIndexed.toLocaleString()} />
          {indexingStatus.aiQueueLength > 0 && (
            <StatRow label="Queue" value={indexingStatus.aiQueueLength.toLocaleString()} />
          )}
          {indexingStatus.isAiProcessing && indexingStatus.currentAiFile && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--xp-text-secondary)',
                marginTop: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={indexingStatus.currentAiFile}
            >
              Current: {indexingStatus.currentAiFile.split(/[\\/]/).pop()}
            </div>
          )}
          {indexingStatus.isAiProcessing && indexingStatus.aiQueueLength > 0 && (
            <ProgressBar
              value={indexingStatus.aiIndexed}
              max={indexingStatus.aiIndexed + indexingStatus.aiQueueLength}
              color="#3b82f6"
            />
          )}
        </div>

        {/* Separator */}
        <div style={{ borderTop: '1px solid var(--xp-border)', margin: '8px 0' }} />

        {/* Search Tokenizer */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--xp-text-secondary)' }}>
              Search Tokenizer
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 3,
                background: indexingStatus.isTokenizerIndexing
                  ? 'rgba(59, 130, 246, 0.2)'
                  : 'rgba(34, 197, 94, 0.15)',
                color: indexingStatus.isTokenizerIndexing ? '#60a5fa' : '#4ade80',
              }}
            >
              {indexingStatus.isTokenizerIndexing ? 'Indexing' : 'Ready'}
            </span>
          </div>
          <StatRow label="Indexed Files" value={indexingStatus.tokenTotalFiles.toLocaleString()} />
          <StatRow label="Total Tokens" value={indexingStatus.tokenTotalTokens.toLocaleString()} />
          {indexingStatus.tokenLastUpdated > 0 && (
            <StatRow
              label="Last Updated"
              value={new Date(indexingStatus.tokenLastUpdated * 1000).toLocaleTimeString()}
            />
          )}
          {indexingStatus.isTokenizerIndexing && (
            <ProgressBar value={70} max={100} color="#22c55e" />
          )}
        </div>

        {/* Reindex button */}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onReindex}
            disabled={indexingStatus.isTokenizerIndexing}
            style={{
              ...smallBtnStyle,
              opacity: indexingStatus.isTokenizerIndexing ? 0.5 : 1,
            }}
          >
            Reindex
          </button>
        </div>
      </div>

      {/* Recent Operations Card */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Recent Operations</div>

        {recentOps.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--xp-text-secondary)', padding: '4px 0' }}>
            No recent operations
          </div>
        ) : (
          <>
            {/* Mini timeline */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                marginBottom: 10,
                padding: '4px 0',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: 'var(--xp-border)',
                  borderRadius: 1,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-evenly',
                }}
              >
                {recentOps.map((op, i) => (
                  <div
                    key={op.id || i}
                    title={`${op.operation} - ${op.success ? 'success' : 'failed'}`}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: opColor(op.operation, op.success),
                      border: '1px solid var(--xp-surface)',
                      flexShrink: 0,
                      cursor: 'default',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Operation list */}
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {recentOps.map((op, i) => (
                <div
                  key={op.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    borderBottom: i < recentOps.length - 1 ? '1px solid var(--xp-border)' : 'none',
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: opColor(op.operation, op.success),
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--xp-text)',
                    }}
                    title={op.details || op.operation}
                  >
                    {op.operation}
                  </span>
                  {op.paths.length > 0 && (
                    <span
                      style={{
                        color: 'var(--xp-text-secondary)',
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {op.paths.length} file{op.paths.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span
                    style={{
                      color: 'var(--xp-text-secondary)',
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {formatRelativeTime(op.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Cleanup Suggestions Card */}
      {suggestions.length > 0 && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Cleanup Suggestions</div>
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              style={{
                ...suggestionRowStyle,
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--xp-border)' : 'none',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--xp-text)',
                    fontWeight: 500,
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--xp-text-secondary)',
                    marginTop: 2,
                  }}
                >
                  {s.description}
                  {s.estimatedSize > 0 && (
                    <span style={{ marginLeft: 4 }}>({formatFileSize(s.estimatedSize)})</span>
                  )}
                </div>
              </div>
              <button onClick={() => onSuggestionAction(s)} style={smallBtnStyle}>
                {s.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MetricCards;
