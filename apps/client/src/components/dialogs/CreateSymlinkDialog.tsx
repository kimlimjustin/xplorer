import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI } from '@/lib/tauri-api';
import { Link2, AlertTriangle } from 'lucide-react';
import { PATH_SEPARATOR, detectSep } from '@/lib/constants';

interface CreateSymlinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  targetPath: string;
}

const CreateSymlinkDialog = ({
  isOpen,
  onClose,
  onComplete,
  targetPath,
}: CreateSymlinkDialogProps) => {
  const { toast } = useToast();
  const [linkPath, setLinkPath] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const targetName = targetPath.split(/[/\\]/).pop() || targetPath;
  const sep = detectSep(targetPath) || PATH_SEPARATOR;
  const isWindows = sep === '\\' || targetPath.match(/^[A-Z]:\\/i);

  useEffect(() => {
    if (isOpen && targetPath) {
      // Default link path: same directory with " - Link" suffix
      const parts = targetPath.split(/[/\\]/);
      const fileName = parts.pop() || '';
      const parentDir = parts.join(sep);
      const dotIdx = fileName.lastIndexOf('.');
      let linkName: string;
      if (dotIdx > 0) {
        linkName = fileName.slice(0, dotIdx) + ' - Link' + fileName.slice(dotIdx);
      } else {
        linkName = fileName + ' - Link';
      }
      setLinkPath(parentDir + sep + linkName);
      setError(null);
      setProcessing(false);

      // Focus the input after render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isOpen, targetPath, sep]);

  const handleSubmit = async () => {
    if (!linkPath.trim()) {
      setError('Link path is required');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      await TauriAPI.createSymlink(targetPath, linkPath.trim());

      const linkName = linkPath.split(/[/\\]/).pop() || linkPath;
      toast({
        title: 'Link Created',
        description: `Created symbolic link "${linkName}"`,
      });

      onComplete?.();
      onClose();
    } catch (err) {
      const message = (err as Error).message || String(err);
      setError(message);
      toast({
        title: 'Create Link Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (processing) return;
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !processing) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--xp-surface)',
          borderRadius: '0.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '480px',
          maxWidth: '90vw',
          overflow: 'hidden',
          border: '1px solid var(--xp-border)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.5rem',
            borderBottom: '1px solid var(--xp-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link2 size={20} style={{ color: 'var(--xp-blue)' }} />
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--xp-text)',
                margin: 0,
              }}
            >
              Create Symbolic Link
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={processing}
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: 'transparent',
              color: 'var(--xp-text-muted)',
              cursor: processing ? 'not-allowed' : 'pointer',
              opacity: processing ? 0.5 : 1,
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!processing) e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Close dialog"
          >
            <svg
              style={{ width: '1.25rem', height: '1.25rem' }}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        >
          {/* Target file info */}
          <div
            style={{
              backgroundColor: 'var(--xp-bg)',
              borderRadius: '0.5rem',
              padding: '1rem',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--xp-text-muted)',
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Target
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--xp-text)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={targetPath}
            >
              {targetName}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--xp-text-muted)',
                marginTop: '0.25rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={targetPath}
            >
              {targetPath}
            </div>
          </div>

          {/* Link path input */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--xp-text)',
                marginBottom: '0.5rem',
              }}
            >
              Link Location
            </label>
            <input
              ref={inputRef}
              type="text"
              value={linkPath}
              onChange={(e) => {
                setLinkPath(e.target.value);
                setError(null);
              }}
              disabled={processing}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--xp-border)',
                borderRadius: '0.375rem',
                backgroundColor: 'var(--xp-bg)',
                color: 'var(--xp-text)',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
                opacity: processing ? 0.5 : 1,
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--xp-blue)';
                e.currentTarget.style.borderColor = 'var(--xp-blue)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--xp-border)';
              }}
              placeholder="Enter the full path for the symbolic link..."
            />
          </div>

          {/* Windows admin warning */}
          {isWindows && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              <AlertTriangle
                size={16}
                style={{ color: '#eab308', marginTop: '0.125rem', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.8rem', color: '#eab308', lineHeight: 1.5 }}>
                On Windows, creating symbolic links requires Developer Mode to be enabled or
                administrator privileges.
              </span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertTriangle
                size={16}
                style={{ color: '#ef4444', marginTop: '0.125rem', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>{error}</span>
            </div>
          )}

          {/* Processing indicator */}
          {processing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem 0',
              }}
            >
              <div
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  border: '2px solid transparent',
                  borderBottomColor: 'var(--xp-blue)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span
                style={{
                  marginLeft: '0.75rem',
                  fontSize: '0.875rem',
                  color: 'var(--xp-text-muted)',
                }}
              >
                Creating link...
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1.5rem',
            borderTop: '1px solid var(--xp-border)',
            backgroundColor: 'var(--xp-bg)',
          }}
        >
          <button
            onClick={handleClose}
            disabled={processing}
            style={{
              padding: '0.5rem 1rem',
              color: 'var(--xp-text)',
              border: 'none',
              borderRadius: '0.25rem',
              background: 'transparent',
              cursor: processing ? 'not-allowed' : 'pointer',
              opacity: processing ? 0.5 : 1,
              fontSize: '0.875rem',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!processing) e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing || !linkPath.trim()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--xp-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: processing || !linkPath.trim() ? 'not-allowed' : 'pointer',
              opacity: processing || !linkPath.trim() ? 0.5 : 1,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'background-color 0.15s',
            }}
            aria-label="Create symbolic link"
          >
            {processing && (
              <div
                style={{
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid transparent',
                  borderBottomColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            )}
            <span>{processing ? 'Creating...' : 'Create'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateSymlinkDialog;
