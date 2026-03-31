import React from 'react';
import type { FileEntry } from '@/lib/tauri-api';
import { useBulkRename } from '@/hooks/use-bulk-rename';
import RenamePatternForm from './bulk-rename/RenamePatternForm';
import RenamePreviewList from './bulk-rename/RenamePreviewList';

interface BulkRenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileEntry[];
  onComplete?: () => void;
}

const BulkRenameDialog = ({ isOpen, onClose, files, onComplete }: BulkRenameDialogProps) => {
  const { state, actions, derived } = useBulkRename(isOpen, files, onClose, onComplete);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--xp-surface)',
          borderRadius: 12,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          width: 820,
          maxWidth: '92vw',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--xp-border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--xp-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 5h14M3 10h10M3 15h6"
                stroke="var(--xp-blue)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M15 13l2 2-2 2"
                stroke="var(--xp-blue)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--xp-text)', margin: 0 }}>
              Bulk Rename
            </h2>
            <span
              style={{
                fontSize: 12,
                color: 'var(--xp-text-muted)',
                backgroundColor: 'var(--xp-bg)',
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={actions.handleClose}
            disabled={state.renaming}
            style={{
              padding: 6,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--xp-text-muted)',
              cursor: state.renaming ? 'not-allowed' : 'pointer',
              opacity: state.renaming ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              if (!state.renaming) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <RenamePatternForm
              pattern={state.pattern}
              replacement={state.replacement}
              patternError={state.patternError}
              renaming={state.renaming}
              regexHelperOpen={state.regexHelperOpen}
              activeTemplateLabel={state.activeTemplateLabel}
              patternInputRef={state.patternInputRef}
              onPatternChange={actions.onPatternChange}
              onReplacementChange={actions.onReplacementChange}
              onApplyPreset={actions.applyPreset}
              onApplyTemplate={actions.applyTemplate}
              onInsertRegexSnippet={actions.insertRegexSnippet}
              onRegexHelperToggle={actions.setRegexHelperOpen}
            />

            <RenamePreviewList
              displayData={derived.displayData}
              conflictSet={derived.conflictSet}
              hasConflicts={derived.hasConflicts}
              changedCount={derived.changedCount}
              results={state.results}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter
          loading={state.loading}
          renaming={state.renaming}
          pattern={state.pattern}
          activeTemplateLabel={state.activeTemplateLabel}
          results={state.results}
          hasChanges={derived.hasChanges}
          hasConflicts={derived.hasConflicts}
          changedCount={derived.changedCount}
          displayDataLength={derived.displayData.length}
          onClose={actions.handleClose}
          onPreview={actions.handlePreview}
          onRename={actions.handleRename}
        />
      </div>
    </div>
  );
};

// ── Footer Sub-component ────────────────────────────────────────────────────

interface DialogFooterProps {
  loading: boolean;
  renaming: boolean;
  pattern: string;
  activeTemplateLabel: string | null;
  results: unknown[] | null;
  hasChanges: boolean;
  hasConflicts: boolean;
  changedCount: number;
  displayDataLength: number;
  onClose: () => void;
  onPreview: () => void;
  onRename: () => void;
}

const DialogFooter = ({
  loading,
  renaming,
  pattern,
  activeTemplateLabel,
  results,
  hasChanges,
  hasConflicts,
  changedCount,
  displayDataLength,
  onClose,
  onPreview,
  onRename,
}: DialogFooterProps) => {
  const typedResults = results as { success: boolean }[] | null;
  const renameDisabled =
    renaming || loading || (!pattern.trim() && !activeTemplateLabel) || !hasChanges || hasConflicts;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 24px',
        borderTop: '1px solid var(--xp-border)',
        backgroundColor: 'var(--xp-bg)',
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--xp-text-muted)' }}>
        {displayDataLength > 0 && !results && hasChanges && (
          <span>
            {changedCount} file{changedCount !== 1 ? 's' : ''} will be renamed
            {hasConflicts && (
              <span style={{ color: 'var(--xp-orange)', marginLeft: 8 }}>(conflicts detected)</span>
            )}
          </span>
        )}
        {typedResults && (
          <span>
            {typedResults.filter((r) => r.success).length} of {typedResults.length} renamed
            successfully
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onClose}
          disabled={renaming}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--xp-text)',
            cursor: renaming ? 'not-allowed' : 'pointer',
            opacity: renaming ? 0.5 : 1,
            fontSize: 13,
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!renaming) {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          {results ? 'Close' : 'Cancel'}
        </button>
        {!results && (
          <>
            <button
              onClick={onPreview}
              disabled={loading || renaming || !pattern.trim()}
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                border: '1px solid var(--xp-border)',
                backgroundColor: 'transparent',
                color: 'var(--xp-text)',
                cursor: loading || renaming || !pattern.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || renaming || !pattern.trim() ? 0.5 : 1,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!(loading || renaming || !pattern.trim())) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--xp-surface-light)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {loading && (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid transparent',
                    borderTopColor: 'var(--xp-text)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              )}
              <span>Preview</span>
            </button>
            <button
              onClick={onRename}
              disabled={renameDisabled}
              style={{
                padding: '7px 20px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'var(--xp-blue)',
                color: '#fff',
                cursor: renameDisabled ? 'not-allowed' : 'pointer',
                opacity: renameDisabled ? 0.5 : 1,
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {renaming && (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid transparent',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              )}
              <span>{renaming ? 'Renaming...' : 'Rename'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkRenameDialog;
