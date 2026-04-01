import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar, type XplorerAPI, type SidebarRenderProps } from '@xplorer/extension-sdk';

interface ImageInfo {
  width: number;
  height: number;
  format: string;
  file_size: number;
  color_type: string;
}

interface BatchImageResult {
  path: string;
  output_path: string;
  success: boolean;
  error: string | null;
  original_size: number;
  new_size: number;
}

interface BatchImageProgress {
  current_file: string;
  processed: number;
  total: number;
  progress_percentage: number;
  status: string;
}

interface SelectedFile {
  name: string;
  path: string;
  is_dir: boolean;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'gif'];
const OUTPUT_FORMATS = ['PNG', 'JPEG', 'WebP', 'BMP', 'TIFF', 'GIF'];

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.includes(ext);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSavings(original: number, newSize: number): string {
  if (original === 0) return '0%';
  const pct = ((original - newSize) / original) * 100;
  return `${pct >= 0 ? '-' : '+'}${Math.abs(pct).toFixed(1)}%`;
}

const card: React.CSSProperties = {
  background: 'var(--xp-surface-light, #2f334d)',
  borderRadius: 10,
  padding: 10,
  border: '1px solid var(--xp-border, #414868)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--xp-text, #c0caf5)',
  marginBottom: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--xp-text-muted)',
  marginBottom: 3,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 12,
  borderRadius: 5,
  border: '1px solid var(--xp-border, #414868)',
  background: 'var(--xp-bg, #1a1b26)',
  color: 'var(--xp-text, #c0caf5)',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23565f89'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  paddingRight: 24,
};

const btnPrimary: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 6,
  border: 'none',
  background: 'var(--xp-blue, #7aa2f7)',
  color: '#fff',
  cursor: 'pointer',
};

const btnDisabled: React.CSSProperties = {
  ...btnPrimary,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const checkboxRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: 'var(--xp-text, #c0caf5)',
  cursor: 'pointer',
};

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--xp-green, #9ece6a)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--xp-red, #f7768e)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" x2="9" y1="9" y2="15" />
      <line x1="9" x2="15" y1="9" y2="15" />
    </svg>
  );
}

function BatchImagePanel({
  currentPath,
  selectedFiles,
  api,
}: {
  currentPath: string;
  selectedFiles: SelectedFile[];
  api: XplorerAPI;
}) {
  // Filter to only image files
  const imageFiles = (selectedFiles || []).filter(f => !f.is_dir && isImageFile(f.name));

  // Resize settings
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [resizeWidth, setResizeWidth] = useState('800');
  const [resizeHeight, setResizeHeight] = useState('600');
  const [maintainAspect, setMaintainAspect] = useState(true);

  // Convert settings
  const [convertEnabled, setConvertEnabled] = useState(false);
  const [outputFormat, setOutputFormat] = useState('JPEG');

  // Quality
  const [quality, setQuality] = useState(85);

  // Output directory
  const [outputDir, setOutputDir] = useState('');

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchImageProgress | null>(null);
  const [results, setResults] = useState<BatchImageResult[] | null>(null);

  // Image info cache
  const [imageInfoMap, setImageInfoMap] = useState<Record<string, ImageInfo>>({});

  // Unlisten ref for progress events
  const unlistenRef = useRef<(() => void) | null>(null);

  // Set default output directory based on current path
  useEffect(() => {
    if (currentPath && !outputDir) {
      const sep = currentPath.includes('\\') ? '\\' : '/';
      setOutputDir(currentPath + sep + 'processed');
    }
  }, [currentPath]);

  // Fetch image info for selected files
  useEffect(() => {
    let cancelled = false;
    async function loadInfo() {
      for (const file of imageFiles) {
        if (imageInfoMap[file.path]) continue;
        try {
          const info = await api.images.getInfo(file.path) as ImageInfo;
          if (!cancelled) {
            setImageInfoMap(prev => ({ ...prev, [file.path]: info }));
          }
        } catch {
          // ignore per-file info errors
        }
      }
    }
    if (imageFiles.length > 0 && imageFiles.length <= 50) {
      loadInfo();
    }
    return () => { cancelled = true; };
  }, [selectedFiles]);

  const handleProcess = useCallback(async () => {
    if (imageFiles.length === 0 || !outputDir) return;

    setProcessing(true);
    setProgress(null);
    setResults(null);

    // Listen for progress events via the Tauri event system
    try {
      const { listenToEvent } = await import('@xplorer/extension-sdk') as unknown as {
        listenToEvent: undefined;
      };
      // Progress will be tracked by the batch results
    } catch {
      // listenToEvent may not be available in extension context
    }

    try {
      const paths = imageFiles.map(f => f.path);
      const operations = {
        resize: resizeEnabled ? {
          width: parseInt(resizeWidth, 10) || 800,
          height: parseInt(resizeHeight, 10) || 600,
          maintain_aspect: maintainAspect,
        } : null,
        convert: convertEnabled ? {
          format: outputFormat,
        } : null,
        quality: (convertEnabled && (outputFormat === 'JPEG' || outputFormat === 'WebP'))
          ? quality
          : null,
      };

      const batchResults = await api.images.batchProcess(paths, operations, outputDir) as BatchImageResult[];
      setResults(batchResults);
    } catch (e: unknown) {
      setResults([{
        path: '',
        output_path: '',
        success: false,
        error: e instanceof Error ? e.message : String(e),
        original_size: 0,
        new_size: 0,
      }]);
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }, [imageFiles, outputDir, resizeEnabled, resizeWidth, resizeHeight, maintainAspect, convertEnabled, outputFormat, quality, api]);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) unlistenRef.current();
    };
  }, []);

  const canProcess = imageFiles.length > 0 && outputDir && (resizeEnabled || convertEnabled) && !processing;

  // Results summary
  const successCount = results?.filter(r => r.success).length || 0;
  const failCount = results?.filter(r => !r.success).length || 0;
  const totalOriginalSize = results?.reduce((s, r) => s + r.original_size, 0) || 0;
  const totalNewSize = results?.filter(r => r.success).reduce((s, r) => s + r.new_size, 0) || 0;

  // No images selected state
  if (imageFiles.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%', padding: 16, textAlign: 'center' }}>
        <div style={{ color: 'var(--xp-text-muted)' }}>
          <ImageIcon />
        </div>
        <span style={{ fontSize: 13, color: 'var(--xp-text-muted)' }}>
          Select image files to process
        </span>
        <span style={{ fontSize: 11, color: 'var(--xp-text-muted)', opacity: 0.6 }}>
          Supported: PNG, JPEG, WebP, BMP, TIFF, GIF
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '100%', fontSize: 13, color: 'var(--xp-text, #c0caf5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ color: 'var(--xp-blue)' }}>
          <ImageIcon />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Batch Image Processor</div>
          <div style={{ fontSize: 11, color: 'var(--xp-text-muted)' }}>
            {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''} selected
          </div>
        </div>
      </div>

      {/* Selected files list */}
      <div style={card}>
        <div style={sectionTitle}>Selected Images</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 130, overflowY: 'auto' }}>
          {imageFiles.map(file => {
            const info = imageInfoMap[file.path];
            return (
              <div key={file.path} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4 }} title={file.path}>
                <div style={{ color: 'var(--xp-text-muted)', flexShrink: 0 }}>
                  <ImageIcon />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  {info && (
                    <div style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>
                      {info.width}x{info.height} {info.format} {formatSize(info.file_size)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resize section */}
      <div style={card}>
        <label style={checkboxRow} onClick={() => setResizeEnabled(!resizeEnabled)}>
          <input
            type="checkbox"
            checked={resizeEnabled}
            onChange={e => setResizeEnabled(e.target.checked)}
            style={{ accentColor: 'var(--xp-blue)' }}
          />
          <span style={{ ...sectionTitle, marginBottom: 0 }}>Resize</span>
        </label>
        {resizeEnabled && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Width (px)</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={resizeWidth}
                  onChange={e => setResizeWidth(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Height (px)</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={resizeHeight}
                  onChange={e => setResizeHeight(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <label style={checkboxRow} onClick={() => setMaintainAspect(!maintainAspect)}>
              <input
                type="checkbox"
                checked={maintainAspect}
                onChange={e => setMaintainAspect(e.target.checked)}
                style={{ accentColor: 'var(--xp-blue)' }}
              />
              Maintain aspect ratio
            </label>
          </div>
        )}
      </div>

      {/* Convert section */}
      <div style={card}>
        <label style={checkboxRow} onClick={() => setConvertEnabled(!convertEnabled)}>
          <input
            type="checkbox"
            checked={convertEnabled}
            onChange={e => setConvertEnabled(e.target.checked)}
            style={{ accentColor: 'var(--xp-blue)' }}
          />
          <span style={{ ...sectionTitle, marginBottom: 0 }}>Convert Format</span>
        </label>
        {convertEnabled && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <label style={labelStyle}>Output Format</label>
              <select
                value={outputFormat}
                onChange={e => setOutputFormat(e.target.value)}
                style={selectStyle}
              >
                {OUTPUT_FORMATS.map(fmt => (
                  <option key={fmt} value={fmt}>{fmt}</option>
                ))}
              </select>
            </div>
            {(outputFormat === 'JPEG' || outputFormat === 'WebP') && (
              <div>
                <label style={labelStyle}>Quality: {quality}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>1</span>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={quality}
                    onChange={e => setQuality(parseInt(e.target.value, 10))}
                    style={{ flex: 1, accentColor: 'var(--xp-blue)' }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>100</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output directory */}
      <div style={card}>
        <div style={sectionTitle}>Output Directory</div>
        <input
          type="text"
          value={outputDir}
          onChange={e => setOutputDir(e.target.value)}
          placeholder="Output directory path"
          style={inputStyle}
        />
      </div>

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess}
        style={canProcess ? btnPrimary : btnDisabled}
      >
        {processing ? 'Processing...' : `Process ${imageFiles.length} Image${imageFiles.length !== 1 ? 's' : ''}`}
      </button>

      {/* Progress bar */}
      {processing && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
            <span style={{ color: 'var(--xp-text)' }}>Processing...</span>
            <span style={{ color: 'var(--xp-text-muted)' }}>
              {progress ? `${progress.processed}/${progress.total}` : '...'}
            </span>
          </div>
          <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--xp-bg, #1a1b26)', overflow: 'hidden' }}>
            <style>{`@keyframes xp-progress-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }`}</style>
            <div style={{
              height: '100%',
              borderRadius: 3,
              transition: 'width 0.3s',
              width: progress ? `${progress.progress_percentage}%` : '30%',
              background: 'linear-gradient(90deg, var(--xp-blue), var(--xp-cyan))',
              animation: progress ? 'none' : 'xp-progress-pulse 1.5s ease-in-out infinite',
            }} />
          </div>
          {progress?.current_file && (
            <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {progress.current_file}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results && !processing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Summary card */}
          <div style={card}>
            <div style={sectionTitle}>Results Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--xp-green)' }}>{successCount}</div>
                <div style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>Processed</div>
              </div>
              {failCount > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--xp-red)' }}>{failCount}</div>
                  <div style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>Failed</div>
                </div>
              )}
              {failCount === 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--xp-blue)' }}>
                    {formatSavings(totalOriginalSize, totalNewSize)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>Size Change</div>
                </div>
              )}
            </div>
            {successCount > 0 && (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--xp-text-muted)', borderTop: '1px solid var(--xp-border)', paddingTop: 6 }}>
                <span>Original: {formatSize(totalOriginalSize)}</span>
                <span>New: {formatSize(totalNewSize)}</span>
              </div>
            )}
          </div>

          {/* Per-file results */}
          <div style={card}>
            <div style={sectionTitle}>File Results</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
              {results.filter(r => r.path).map((result, i) => {
                const fileName = result.path.split(/[/\\]/).pop() || result.path;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, background: result.success ? 'transparent' : 'color-mix(in srgb, var(--xp-red) 7%, transparent)' }}>
                    <div style={{ flexShrink: 0 }}>
                      {result.success ? <CheckIcon /> : <ErrorIcon />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
                      {result.success ? (
                        <div style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>
                          {formatSize(result.original_size)} -&gt; {formatSize(result.new_size)} ({formatSavings(result.original_size, result.new_size)})
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: 'var(--xp-red)' }}>{result.error}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Open output button */}
          {successCount > 0 && (
            <button
              onClick={() => api.navigation.navigateTo(outputDir)}
              style={{ ...btnPrimary, background: 'var(--xp-surface-light)', color: 'var(--xp-text)', border: '1px solid var(--xp-border)' }}
            >
              Open Output Folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

let api: XplorerAPI;

Sidebar.register({
  id: 'batch-image',
  title: 'Batch Image Processor',
  description: 'Batch resize, convert, and compress images',
  icon: 'image',
  location: 'right',
  permissions: ['files:read', 'files:write'],
  render: (props: SidebarRenderProps) => React.createElement(BatchImagePanel, {
    currentPath: (props.currentPath as string) || '',
    selectedFiles: (props.selectedFiles as Array<{ name: string; path: string; is_dir: boolean }>) || [],
    api,
  }),
  onActivate: (injectedApi: XplorerAPI) => { api = injectedApi; },
});
