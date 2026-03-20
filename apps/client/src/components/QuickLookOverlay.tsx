import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { convertAssetUrl } from '@/lib/transport';
import { getFileIcon, formatFileSize, formatDate } from '@/lib/utils';
import { defaultPreviewFactory, type PreviewType } from '@/lib/preview-factory';
import { Prism as SyntaxHighlighter, type SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ── Language detection (borrowed from CodePreview) ──────────────────────────

const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    ps1: 'powershell',
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    md: 'markdown',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
  };
  return map[ext] || 'text';
};

// ── File type helpers ───────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'svg',
  'ico',
  'tiff',
]);

const TEXT_EXTENSIONS = new Set([
  'txt',
  'log',
  'ini',
  'cfg',
  'conf',
  'md',
  'markdown',
  'json',
  'csv',
  'xml',
  'yaml',
  'yml',
  'toml',
  'js',
  'ts',
  'jsx',
  'tsx',
  'py',
  'java',
  'cpp',
  'c',
  'cs',
  'php',
  'rb',
  'go',
  'rs',
  'html',
  'css',
  'scss',
  'less',
  'vue',
  'svelte',
  'sql',
  'sh',
  'bash',
  'ps1',
  'dockerfile',
  'makefile',
  'gitignore',
  'env',
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'ogv']);

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'flac',
  'm4a',
  'aac',
  'wma',
  'opus',
  'aiff',
]);

const getExt = (name: string) : string => {
  return name.split('.').pop()?.toLowerCase() || '';
}

// ── Inline preview renderers ────────────────────────────────────────────────

const ImageQuickPreview: React.FC<{ file: FileEntry }> = ({ file }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const src = convertAssetUrl(file.path);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {!loaded && !error && (
        <div style={{ color: 'var(--xp-text-secondary)', fontSize: 12 }}>Loading image...</div>
      )}
      {error && (
        <div style={{ color: 'var(--xp-text-secondary)', fontSize: 12 }}>Failed to load image</div>
      )}
      <img
        src={src}
        alt={file.name}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          display: error ? 'none' : 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      />
    </div>
  );
};

const TextQuickPreview: React.FC<{ file: FileEntry }> = ({ file }) => {
  const RSH = SyntaxHighlighter as unknown as React.FC<SyntaxHighlighterProps>;
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const language = getLanguageFromExtension(file.name);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);

    if (file.size > 2 * 1024 * 1024) {
      setError('File too large for quick preview');
      return;
    }

    TauriAPI.readTextFile(file.path)
      .then((text) => {
        if (cancelled) return;
        // Limit to first ~100 lines
        const lines = text.split('\n');
        const truncated =
          lines.length > 100 ? lines.slice(0, 100).join('\n') + '\n... (truncated)' : text;
        setContent(truncated);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to read file');
      });

    return () => {
      cancelled = true;
    };
  }, [file.path, file.size]);

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--xp-text-secondary)',
          fontSize: 12,
        }}
      >
        {error}
      </div>
    );
  }

  if (content === null) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--xp-text-secondary)',
          fontSize: 12,
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <RSH
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '12px',
          fontSize: '11px',
          lineHeight: '1.5',
          height: '100%',
          backgroundColor: 'var(--xp-surface)',
          color: 'var(--xp-text)',
        }}
        showLineNumbers
        wrapLines
        wrapLongLines
      >
        {content}
      </RSH>
    </div>
  );
};

const FolderQuickPreview: React.FC<{ file: FileEntry }> = ({ file }) => {
  const [itemCount, setItemCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    TauriAPI.readDirectory(file.path)
      .then((entries) => {
        if (!cancelled) setItemCount(entries.length);
      })
      .catch(() => {
        if (!cancelled) setItemCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file.path]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 48 }}>{getFileIcon(file)}</div>
      <div style={{ color: 'var(--xp-text)', fontSize: 14, fontWeight: 500 }}>Folder</div>
      {itemCount !== null && (
        <div style={{ color: 'var(--xp-text-secondary)', fontSize: 12 }}>
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

const GenericQuickPreview: React.FC<{ file: FileEntry; category: PreviewType }> = ({
  file,
  category,
}) => {
  const ext = getExt(file.name);
  const isVideo = VIDEO_EXTENSIONS.has(ext);
  const isAudio = AUDIO_EXTENSIONS.has(ext);
  const isPdf = ext === 'pdf';

  let typeLabel = category !== 'unknown' ? category : file.file_type || 'File';
  if (isVideo) typeLabel = 'Video';
  if (isAudio) typeLabel = 'Audio';
  if (isPdf) typeLabel = 'PDF Document';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 48 }}>{getFileIcon(file)}</div>
      <div
        style={{
          color: 'var(--xp-text)',
          fontSize: 14,
          fontWeight: 500,
          textTransform: 'capitalize',
        }}
      >
        {typeLabel}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          color: 'var(--xp-text-secondary)',
          fontSize: 12,
          textAlign: 'center',
        }}
      >
        <div>Size: {formatFileSize(file.size)}</div>
        <div>Modified: {formatDate(file.modified)}</div>
        {ext && <div>Extension: .{ext}</div>}
      </div>
    </div>
  );
};

// ── Main overlay ────────────────────────────────────────────────────────────

interface QuickLookOverlayProps {
  file: FileEntry;
  onClose: () => void;
}

const QuickLookOverlay = ({ file, onClose }: QuickLookOverlayProps) => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Fade in on mount
  useEffect(() => {
    // Force a frame so the transition triggers
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setVisible(false);
    // Wait for fade-out, then unmount
    setTimeout(onClose, 200);
  }, [onClose]);

  // Keyboard: Escape or Space closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleClose]);

  // Click on backdrop closes
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        handleClose();
      }
    },
    [handleClose],
  );

  // Determine what to render
  const ext = getExt(file.name);
  const category = file.is_dir
    ? ('folder' as PreviewType)
    : defaultPreviewFactory.getFileType(file);
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isText = TEXT_EXTENSIONS.has(ext);

  let previewContent: React.ReactNode;
  if (file.is_dir) {
    previewContent = <FolderQuickPreview file={file} />;
  } else if (isImage) {
    previewContent = <ImageQuickPreview file={file} />;
  } else if (isText) {
    previewContent = <TextQuickPreview file={file} />;
  } else {
    previewContent = <GenericQuickPreview file={file} category={category} />;
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: visible && !closing ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: visible && !closing ? 'blur(4px)' : 'blur(0px)',
        transition: 'background-color 0.2s ease, backdrop-filter 0.2s ease',
      }}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: 600,
          height: '80vh',
          maxHeight: 500,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--xp-border)',
          backgroundColor: 'var(--xp-bg)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          opacity: visible && !closing ? 1 : 0,
          transform: visible && !closing ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid var(--xp-border)',
            backgroundColor: 'var(--xp-surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{getFileIcon(file)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--xp-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={file.name}
            >
              {file.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--xp-text-secondary)' }}>
              {file.is_dir ? 'Folder' : formatFileSize(file.size)}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--xp-text-secondary)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
            title="Close (Space / Escape)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        {/* Preview content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {previewContent}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid var(--xp-border)',
            backgroundColor: 'var(--xp-surface)',
            fontSize: 11,
            color: 'var(--xp-text-secondary)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          Press{' '}
          <kbd
            style={{
              padding: '1px 5px',
              borderRadius: 3,
              border: '1px solid var(--xp-border)',
              backgroundColor: 'var(--xp-bg)',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            Space
          </kbd>{' '}
          or{' '}
          <kbd
            style={{
              padding: '1px 5px',
              borderRadius: 3,
              border: '1px solid var(--xp-border)',
              backgroundColor: 'var(--xp-bg)',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            Esc
          </kbd>{' '}
          to close
        </div>
      </div>
    </div>
  );
}

export default QuickLookOverlay;
