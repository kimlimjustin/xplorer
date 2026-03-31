import React, { useState, useCallback } from 'react';
import { TauriAPI } from '@/lib/tauri-api';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePerformanceStats, type CleanupSuggestion } from '@/hooks/use-performance-stats';
import {
  sectionHeaderStyle,
  type PerformanceDashboardProps,
} from './performance-dashboard-helpers';
import MetricCards from './performance/MetricCards';
import OrganizerTabContent from './performance/PerformanceCharts';

// ── Main component ────────────────────────────────────────────────────────────

const PerformanceDashboard = React.memo(
  ({ currentPath, allFiles, navigateToPath }: PerformanceDashboardProps) => {
    const [metricsExpanded, setMetricsExpanded] = useState(true);
    const [organizerExpanded, setOrganizerExpanded] = useState(true);

    const {
      directoryStats,
      indexingStatus,
      recentOps,
      suggestions,
      memoryUsage,
      isLoading,
      refreshStats,
    } = usePerformanceStats(currentPath, allFiles, true);

    const handleReindex = useCallback(async () => {
      try {
        await TauriAPI.rebuildTokenIndex();
      } catch {
        // silently fail
      }
      refreshStats();
    }, [refreshStats]);

    const handleEmptyTrash = useCallback(async () => {
      try {
        await TauriAPI.emptyTrash();
      } catch {
        // silently fail
      }
      refreshStats();
    }, [refreshStats]);

    const handleSuggestionAction = useCallback(
      (suggestion: CleanupSuggestion) => {
        if (suggestion.id === 'trash') {
          handleEmptyTrash();
        } else if (suggestion.id === 'large-files' && navigateToPath) {
          navigateToPath(currentPath);
        } else if (suggestion.id === 'untagged' && navigateToPath) {
          navigateToPath(currentPath);
        }
      },
      [handleEmptyTrash, navigateToPath, currentPath],
    );

    const handleCollapseAll = useCallback(() => {
      setMetricsExpanded(false);
      setOrganizerExpanded(false);
    }, []);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 0%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Single scrollable container for both sections */}
        <div
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1 1 0%',
            minHeight: 0,
          }}
        >
          {/* Performance Metrics Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => setMetricsExpanded((v) => !v)}
                className="hover:bg-xp-surface-light"
                style={sectionHeaderStyle}
              >
                {metricsExpanded ? (
                  <ChevronDown size={14} style={{ flexShrink: 0 }} />
                ) : (
                  <ChevronRight size={14} style={{ flexShrink: 0 }} />
                )}
                Performance Metrics
              </button>
              <button
                onClick={handleCollapseAll}
                style={{
                  fontSize: 10,
                  color: 'var(--xp-text-secondary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  opacity: 0.7,
                  transition: 'opacity 0.15s',
                }}
                title="Collapse all sections"
              >
                collapse all
              </button>
            </div>

            {metricsExpanded && (
              <MetricCards
                directoryStats={directoryStats}
                indexingStatus={indexingStatus}
                recentOps={recentOps}
                suggestions={suggestions}
                memoryUsage={memoryUsage}
                isLoading={isLoading}
                onRefresh={refreshStats}
                onReindex={handleReindex}
                onSuggestionAction={handleSuggestionAction}
              />
            )}
          </div>

          {/* File Organizer Section */}
          <div>
            <button
              onClick={() => setOrganizerExpanded((v) => !v)}
              className="hover:bg-xp-surface-light"
              style={sectionHeaderStyle}
            >
              {organizerExpanded ? (
                <ChevronDown size={14} style={{ flexShrink: 0 }} />
              ) : (
                <ChevronRight size={14} style={{ flexShrink: 0 }} />
              )}
              File Organizer
            </button>

            {organizerExpanded && (
              <OrganizerTabContent currentPath={currentPath} navigateToPath={navigateToPath} />
            )}
          </div>
        </div>
      </div>
    );
  },
);
PerformanceDashboard.displayName = 'PerformanceDashboard';

export default PerformanceDashboard;
