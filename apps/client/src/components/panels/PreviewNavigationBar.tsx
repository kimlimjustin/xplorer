import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { FileEntry } from '@/lib/tauri-api';
import { convertAssetUrl } from '@/lib/transport';
import type { PreviewHistoryEntry } from '@/hooks/use-preview-history';

// ─── Image extension check (inline to avoid extra import) ───────────────────
const IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'ico',
  'svg',
  'avif',
  'tiff',
  'tif',
]);
const isImage = (file: FileEntry) : boolean => {
  if (file.is_dir) return false;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTS.has(ext);
}
const getExt = (name: string) : string => {
  return name.split('.').pop()?.toUpperCase() ?? '';
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const barStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderBottom: '1px solid var(--xp-border)',
  background: 'var(--xp-surface)',
  flexShrink: 0,
};

const topRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
};

const arrowBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: 4,
  border: '1px solid var(--xp-border)',
  background: 'transparent',
  color: 'var(--xp-text-secondary)',
  cursor: 'pointer',
  flexShrink: 0,
  fontSize: 12,
  lineHeight: 1,
  transition: 'background 0.12s, color 0.12s',
};

const arrowBtnDisabledStyle: React.CSSProperties = {
  ...arrowBtnStyle,
  opacity: 0.35,
  cursor: 'default',
};

const posIndicatorStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--xp-text-secondary)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  minWidth: 40,
  textAlign: 'center',
};

const tabStripStyle: React.CSSProperties = {
  display: 'flex',
  overflowX: 'auto',
  overflowY: 'hidden',
  gap: 2,
  padding: '0 8px 4px',
  scrollbarWidth: 'none', // Firefox
};

const tabStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 4,
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--xp-text-secondary)',
  fontSize: 11,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: 'background 0.12s, border-color 0.12s, color 0.12s',
  maxWidth: 120,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: 'var(--xp-surface-light, rgba(255,255,255,0.08))',
  borderColor: 'var(--xp-border)',
  color: 'var(--xp-text)',
};

const thumbStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 3,
  objectFit: 'cover',
  flexShrink: 0,
};

const extBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: 3,
  background: 'var(--xp-bg, rgba(0,0,0,0.2))',
  color: 'var(--xp-text-secondary)',
  fontSize: 8,
  fontWeight: 600,
  flexShrink: 0,
  overflow: 'hidden',
  letterSpacing: '-0.5px',
};

const recentDropdownBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--xp-border)',
  background: 'transparent',
  color: 'var(--xp-text-secondary)',
  fontSize: 10,
  cursor: 'pointer',
  marginLeft: 'auto',
  flexShrink: 0,
  transition: 'background 0.12s',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  right: 0,
  zIndex: 100,
  minWidth: 200,
  maxWidth: 300,
  maxHeight: 240,
  overflowY: 'auto',
  background: 'var(--xp-surface)',
  border: '1px solid var(--xp-border)',
  borderRadius: 6,
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  padding: '4px 0',
  marginTop: 2,
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  fontSize: 11,
  color: 'var(--xp-text)',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  transition: 'background 0.1s',
};

const compareToggleStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 4,
  border: '1px solid var(--xp-border)',
  background: 'transparent',
  color: 'var(--xp-text-secondary)',
  fontSize: 10,
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.12s, color 0.12s',
};

const compareToggleActiveStyle: React.CSSProperties = {
  ...compareToggleStyle,
  background: 'rgba(122, 162, 247, 0.15)',
  borderColor: 'var(--xp-blue, #7aa2f7)',
  color: 'var(--xp-blue, #7aa2f7)',
};

// ─── Component ───────────────────────────────────────────────────────────────

export interface PreviewNavigationBarProps {
  files: FileEntry[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  /** History entries (most recent first) */
  getHistory: () => PreviewHistoryEntry[];
  historyVersion: number;
  onHistorySelect: (file: FileEntry) => void;
  /** Compare toggle */
  compareMode: boolean;
  onCompareToggle: () => void;
  showCompareToggle: boolean;
}

// SVG arrows
const LeftArrow = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const RightArrow = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const ChevronDown = () => (
  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

const ClockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
      clipRule="evenodd"
    />
  </svg>
);

const PreviewNavigationBar = ({
  files,
  currentIndex,
  onIndexChange,
  getHistory,
  historyVersion: _historyVersion,
  onHistorySelect,
  compareMode,
  onCompareToggle,
  showCompareToggle,
}: PreviewNavigationBarProps) => {
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const total = files.length;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < total - 1;

  // Scroll active tab into view
  useEffect(() => {
    const strip = tabStripRef.current;
    if (!strip) return;
    const activeTab = strip.children[currentIndex] as HTMLElement | undefined;
    if (activeTab) {
      activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!recentOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRecentOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [recentOpen]);

  const handlePrev = useCallback(() => {
    if (canPrev) onIndexChange(currentIndex - 1);
  }, [canPrev, currentIndex, onIndexChange]);

  const handleNext = useCallback(() => {
    if (canNext) onIndexChange(currentIndex + 1);
  }, [canNext, currentIndex, onIndexChange]);

  // Pull history snapshot when dropdown opens
  const historyItems = recentOpen ? getHistory() : [];

  return (
    <div style={barStyle}>
      {/* Top row: arrows + position + recent + compare */}
      <div style={topRowStyle}>
        <button
          style={canPrev ? arrowBtnStyle : arrowBtnDisabledStyle}
          onClick={handlePrev}
          disabled={!canPrev}
          title="Previous file (Left arrow)"
          aria-label="Previous file"
          onMouseEnter={(e) => {
            if (canPrev)
              e.currentTarget.style.background = 'var(--xp-surface-light, rgba(255,255,255,0.06))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LeftArrow />
        </button>

        <span style={posIndicatorStyle}>
          {currentIndex + 1} / {total}
        </span>

        <button
          style={canNext ? arrowBtnStyle : arrowBtnDisabledStyle}
          onClick={handleNext}
          disabled={!canNext}
          title="Next file (Right arrow)"
          aria-label="Next file"
          onMouseEnter={(e) => {
            if (canNext)
              e.currentTarget.style.background = 'var(--xp-surface-light, rgba(255,255,255,0.06))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <RightArrow />
        </button>

        {/* Compare toggle */}
        {showCompareToggle && (
          <button
            style={compareMode ? compareToggleActiveStyle : compareToggleStyle}
            onClick={onCompareToggle}
            title="Compare with previous file"
            aria-label="Compare with previous file"
            onMouseEnter={(e) => {
              if (!compareMode)
                e.currentTarget.style.background =
                  'var(--xp-surface-light, rgba(255,255,255,0.06))';
            }}
            onMouseLeave={(e) => {
              if (!compareMode) e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
            Compare
          </button>
        )}

        {/* Recent dropdown */}
        <div style={{ position: 'relative', marginLeft: 'auto' }} ref={dropdownRef}>
          <button
            style={recentDropdownBtnStyle}
            onClick={() => setRecentOpen(!recentOpen)}
            title="Recently previewed files"
            aria-label="Recently previewed files"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--xp-surface-light, rgba(255,255,255,0.06))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <ClockIcon />
            Recent
            <ChevronDown />
          </button>

          {recentOpen && (
            <div style={dropdownStyle}>
              {historyItems.length === 0 ? (
                <div
                  style={{
                    padding: '12px 16px',
                    fontSize: 11,
                    color: 'var(--xp-text-secondary)',
                    textAlign: 'center',
                  }}
                >
                  No recent files
                </div>
              ) : (
                historyItems.map((entry) => (
                  <button
                    key={entry.file.path}
                    style={dropdownItemStyle}
                    onClick={() => {
                      onHistorySelect(entry.file);
                      setRecentOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        'var(--xp-surface-light, rgba(255,255,255,0.06))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title={entry.file.path}
                  >
                    {isImage(entry.file) ? (
                      <img
                        src={convertAssetUrl(entry.file.path)}
                        alt=""
                        style={{ ...thumbStyle, width: 16, height: 16 }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span style={{ ...extBadgeStyle, width: 16, height: 16, fontSize: 7 }}>
                        {getExt(entry.file.name).slice(0, 4)}
                      </span>
                    )}
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {entry.file.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab strip */}
      <div
        ref={tabStripRef}
        style={tabStripStyle}
        // Hide scrollbar on WebKit
        className="preview-nav-tab-strip"
      >
        {files.map((file, idx) => {
          const isActive = idx === currentIndex;
          return (
            <button
              key={file.path}
              style={isActive ? activeTabStyle : tabStyle}
              onClick={() => onIndexChange(idx)}
              title={file.name}
              aria-label={`Preview ${file.name}`}
              aria-current={isActive ? 'true' : undefined}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background =
                    'var(--xp-surface-light, rgba(255,255,255,0.06))';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {isImage(file) ? (
                <img
                  src={convertAssetUrl(file.path)}
                  alt=""
                  style={thumbStyle}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span style={extBadgeStyle}>{getExt(file.name).slice(0, 4)}</span>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(PreviewNavigationBar);
