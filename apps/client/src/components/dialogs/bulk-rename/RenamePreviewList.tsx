import React from 'react';
import { diffStrings, DiffText, WarningIcon, CheckIcon } from '../bulk-rename-helpers';
import type { BulkRenameResult } from '@/lib/tauri-api';

interface DisplayItem {
  original_name: string;
  new_name: string;
  success?: boolean;
  error?: string | null;
}

interface RenamePreviewListProps {
  displayData: DisplayItem[];
  conflictSet: Set<string>;
  hasConflicts: boolean;
  changedCount: number;
  results: BulkRenameResult[] | null;
}

const RenamePreviewList = ({
  displayData,
  conflictSet,
  hasConflicts,
  changedCount,
  results,
}: RenamePreviewListProps) => {
  if (displayData.length === 0) return null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <label
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--xp-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {results ? 'Results' : 'Preview'}
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 11,
            color: 'var(--xp-text-muted)',
          }}
        >
          {hasConflicts && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--xp-orange)',
              }}
            >
              <WarningIcon /> {conflictSet.size} conflict
              {conflictSet.size !== 1 ? 's' : ''}
            </span>
          )}
          <span>{changedCount} changed</span>
          <span>{displayData.length - changedCount} unchanged</span>
        </div>
      </div>
      <div
        style={{
          backgroundColor: 'var(--xp-bg)',
          borderRadius: 8,
          border: '1px solid var(--xp-border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--xp-surface)',
                  zIndex: 1,
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    color: 'var(--xp-text-muted)',
                    fontWeight: 500,
                    fontSize: 11,
                    borderBottom: '1px solid var(--xp-border)',
                    width: '42%',
                  }}
                >
                  Current Name
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '8px 4px',
                    color: 'var(--xp-text-muted)',
                    fontWeight: 500,
                    fontSize: 11,
                    borderBottom: '1px solid var(--xp-border)',
                    width: '30px',
                  }}
                />
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    color: 'var(--xp-text-muted)',
                    fontWeight: 500,
                    fontSize: 11,
                    borderBottom: '1px solid var(--xp-border)',
                    width: '42%',
                  }}
                >
                  New Name
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '8px 10px',
                    color: 'var(--xp-text-muted)',
                    fontWeight: 500,
                    fontSize: 11,
                    borderBottom: '1px solid var(--xp-border)',
                    width: '40px',
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((item, index) => (
                <PreviewRow
                  key={item.original_name}
                  item={item}
                  index={index}
                  totalCount={displayData.length}
                  isConflict={
                    conflictSet.has(item.new_name) && item.original_name !== item.new_name
                  }
                  isResult={results !== null}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conflict warning */}
      {hasConflicts && !results && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: 6,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--xp-orange)',
          }}
        >
          <WarningIcon />
          <span>
            {conflictSet.size} naming conflict{conflictSet.size !== 1 ? 's' : ''} detected. Multiple
            files would end up with the same name. Adjust the pattern to avoid data loss.
          </span>
        </div>
      )}

      {/* Error details for results */}
      {results && results.some((r) => !r.success) && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results
            .filter((r) => !r.success)
            .map((r) => (
              <div
                key={r.original_name}
                style={{
                  fontSize: 11,
                  color: 'var(--xp-red)',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  padding: '4px 10px',
                  borderRadius: 4,
                }}
              >
                <span style={{ fontWeight: 600 }}>{r.original_name}:</span> {r.error}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

// ── Row Sub-component ───────────────────────────────────────────────────────

interface PreviewRowProps {
  item: DisplayItem;
  index: number;
  totalCount: number;
  isConflict: boolean;
  isResult: boolean;
}

const PreviewRow = ({ item, index, totalCount, isConflict, isResult }: PreviewRowProps) => {
  const nameChanged = item.original_name !== item.new_name;
  const diff = nameChanged ? diffStrings(item.original_name, item.new_name) : null;

  const rowBg =
    isResult && item.success === false
      ? 'rgba(239, 68, 68, 0.08)'
      : isConflict
        ? 'rgba(245, 158, 11, 0.06)'
        : 'transparent';

  let statusCell: React.ReactNode;
  if (isResult) {
    statusCell = item.success ? (
      <span style={{ color: 'var(--xp-green)', fontSize: 11, fontWeight: 600 }} title="Success">
        OK
      </span>
    ) : (
      <span
        style={{ color: 'var(--xp-red)', fontSize: 11, fontWeight: 600, cursor: 'help' }}
        title={item.error || 'Failed'}
      >
        ERR
      </span>
    );
  } else if (isConflict) {
    statusCell = (
      <span title="Name conflict - multiple files would have the same name">
        <WarningIcon />
      </span>
    );
  } else if (nameChanged) {
    statusCell = (
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'var(--xp-blue)',
        }}
        title="Will be renamed"
      />
    );
  } else {
    statusCell = (
      <span title="No change">
        <CheckIcon />
      </span>
    );
  }

  return (
    <tr
      style={{
        borderBottom: index < totalCount - 1 ? '1px solid var(--xp-border)' : 'none',
        backgroundColor: rowBg,
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!(isResult && item.success === false) && !isConflict) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
        }
      }}
      onMouseLeave={(e) => {
        if (isResult && item.success === false) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
        } else if (isConflict) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(245, 158, 11, 0.06)';
        } else {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }
      }}
    >
      {/* Current Name */}
      <td
        style={{
          padding: '6px 10px',
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'var(--xp-text)',
          maxWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={item.original_name}
      >
        {diff ? <DiffText spans={diff.oldSpans} /> : item.original_name}
      </td>

      {/* Arrow */}
      <td
        style={{
          padding: '6px 4px',
          textAlign: 'center',
          color: nameChanged ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
          fontSize: 14,
        }}
      >
        {nameChanged ? '\u2192' : '='}
      </td>

      {/* New Name */}
      <td
        style={{
          padding: '6px 10px',
          fontFamily: 'monospace',
          fontSize: 12,
          color: nameChanged ? 'var(--xp-text)' : 'var(--xp-text-muted)',
          maxWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={item.new_name}
      >
        {diff ? (
          <DiffText spans={diff.newSpans} />
        ) : (
          <span style={{ fontStyle: 'italic' }}>{item.original_name}</span>
        )}
      </td>

      {/* Status */}
      <td style={{ padding: '6px 10px', textAlign: 'center' }}>{statusCell}</td>
    </tr>
  );
};

export default RenamePreviewList;
