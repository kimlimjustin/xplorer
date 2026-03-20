import { useState, useRef } from 'react';
import { Download, Upload, Clock, CheckCircle, AlertTriangle, FileJson } from 'lucide-react';
import { SectionTitle, SettingRow, Divider } from './shared';

const EXPORT_VERSION = '0.4.0';
const LAST_EXPORT_KEY = 'xplorer:last-export-date';

const KNOWN_KEYS = [
  'xplorer:settings',
  'xplorer:ui-state',
  'xplorer:font-size',
  'xplorer:marketplace-url',
  'xplorer:auto-whitelist-visited',
  'xplorer:split-layout',
  'xplorer:tour-completed',
  'xplorer:beta-warning-dismissed',
  'xplorer:custom-themes',
  'xplorer:last-export-date',
  'xplorer_openai_key',
  'xplorer_ollama_url',
  'xplorer-vim-mode',
  'xplorer-installed-extensions',
  'xplorer-search-history',
  'xplorer-permission-violations',
  'xplorer-sync-api-url',
  'xplorer-sync-token',
  'xplorer-auto-sync-enabled',
  'gdrive-plugin-settings',
  'gdrive-file-cache',
];

const KNOWN_PREFIXES = ['xplorer:', 'xplorer_', 'xplorer-', 'gdrive-'];

interface ExportPayload {
  version: string;
  exportDate: string;
  settings: Record<string, string>;
}

type ImportStatus =
  | { type: 'idle' }
  | { type: 'preview'; payload: ExportPayload; categories: ImportCategory[] }
  | { type: 'success'; count: number }
  | { type: 'error'; message: string };

interface ImportCategory {
  label: string;
  keys: string[];
}

const collectExportableKeys = () : string[] => {
  const keys = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (KNOWN_KEYS.includes(key) || KNOWN_PREFIXES.some((p) => key.startsWith(p))) {
      keys.add(key);
    }
  }
  return Array.from(keys).sort();
}

const categorizeKeys = (keys: string[]) : ImportCategory[] => {
  const categories: ImportCategory[] = [];
  const buckets: Record<string, string[]> = {
    'App Settings': [],
    'Appearance & Theme': [],
    'AI & Search': [],
    Extensions: [],
    'Sync & Cloud': [],
    Other: [],
  };

  for (const key of keys) {
    if (
      key === 'xplorer:settings' ||
      key === 'xplorer:ui-state' ||
      key === 'xplorer:font-size' ||
      key === 'xplorer:split-layout'
    ) {
      buckets['App Settings'].push(key);
    } else if (key.includes('theme') || key.includes('custom-themes')) {
      buckets['Appearance & Theme'].push(key);
    } else if (key.includes('openai') || key.includes('ollama') || key.includes('search')) {
      buckets['AI & Search'].push(key);
    } else if (key.includes('extension') || key.includes('marketplace')) {
      buckets['Extensions'].push(key);
    } else if (key.includes('sync') || key.includes('gdrive')) {
      buckets['Sync & Cloud'].push(key);
    } else {
      buckets['Other'].push(key);
    }
  }

  for (const [label, keyList] of Object.entries(buckets)) {
    if (keyList.length > 0) {
      categories.push({ label, keys: keyList });
    }
  }

  return categories;
}

const buildExportPayload = () : ExportPayload => {
  const keys = collectExportableKeys();
  const settings: Record<string, string> = {};
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      settings[key] = value;
    }
  }
  return {
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    settings,
  };
}

const downloadJson = (payload: ExportPayload) => {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `xplorer-settings-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const validatePayload = (data: unknown) : data is ExportPayload => {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== 'string') return false;
  if (typeof obj.exportDate !== 'string') return false;
  if (typeof obj.settings !== 'object' || obj.settings === null) return false;
  const settings = obj.settings as Record<string, unknown>;
  for (const [key, val] of Object.entries(settings)) {
    if (typeof key !== 'string' || typeof val !== 'string') return false;
  }
  return true;
}

const BackupRestoreSettings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>({ type: 'idle' });
  const [lastExportDate, setLastExportDate] = useState<string | null>(() => {
    return localStorage.getItem(LAST_EXPORT_KEY);
  });

  const handleExport = () => {
    try {
      const payload = buildExportPayload();
      downloadJson(payload);
      const now = new Date().toISOString();
      localStorage.setItem(LAST_EXPORT_KEY, now);
      setLastExportDate(now);
    } catch {
      setImportStatus({ type: 'error', message: 'Failed to export settings.' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const data = JSON.parse(text);

        if (!validatePayload(data)) {
          setImportStatus({
            type: 'error',
            message:
              'Invalid backup file structure. Expected version, exportDate, and settings fields.',
          });
          return;
        }

        const keys = Object.keys(data.settings);
        const categories = categorizeKeys(keys);
        setImportStatus({ type: 'preview', payload: data, categories });
      } catch {
        setImportStatus({
          type: 'error',
          message: 'Invalid JSON file. Please select a valid Xplorer settings backup.',
        });
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Failed to read file.' });
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyImport = () => {
    if (importStatus.type !== 'preview') return;
    const { payload } = importStatus;
    let count = 0;
    for (const [key, value] of Object.entries(payload.settings)) {
      localStorage.setItem(key, value);
      count++;
    }
    setImportStatus({ type: 'success', count });
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleCancelImport = () => {
    setImportStatus({ type: 'idle' });
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-1">
      <SectionTitle
        title="Export"
        description="Download a backup of your settings as a JSON file"
      />

      <SettingRow
        icon={Download}
        label="Export Settings"
        description="Save all your preferences, theme, and configuration to a file"
      >
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-xp-accent text-white hover:opacity-90 transition-opacity"
        >
          <Download size={14} />
          Export
        </button>
      </SettingRow>

      {lastExportDate && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-xp-text-secondary">
          <Clock size={12} className="shrink-0" />
          <span>Last exported: {formatDate(lastExportDate)}</span>
        </div>
      )}

      <Divider />
      <SectionTitle
        title="Import"
        description="Restore settings from a previously exported backup file"
      />

      <SettingRow
        icon={Upload}
        label="Import Settings"
        description="Load settings from a .json backup file"
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-xp-border bg-xp-surface text-xp-text hover:bg-xp-surface-light transition-colors"
        >
          <Upload size={14} />
          Choose File
        </button>
      </SettingRow>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileSelect}
      />

      {importStatus.type === 'error' && (
        <div className="mx-4 mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle size={16} className="shrink-0 text-red-400 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-red-400">Import Error</div>
            <div className="text-xs text-red-400/80 mt-0.5">{importStatus.message}</div>
          </div>
          <button
            onClick={handleCancelImport}
            className="ml-auto shrink-0 text-xs text-red-400/60 hover:text-red-400 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {importStatus.type === 'preview' && (
        <div className="mx-4 mt-2 rounded-lg border border-xp-border bg-xp-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileJson size={16} className="text-xp-accent" />
            <span className="text-sm font-medium text-xp-text">Import Preview</span>
          </div>

          <div className="text-xs text-xp-text-secondary mb-3 space-y-1">
            <div>
              Version:{' '}
              <span className="font-mono text-xp-text">{importStatus.payload.version}</span>
            </div>
            <div>
              Exported:{' '}
              <span className="text-xp-text">{formatDate(importStatus.payload.exportDate)}</span>
            </div>
            <div>
              Total keys:{' '}
              <span className="font-mono text-xp-text">
                {Object.keys(importStatus.payload.settings).length}
              </span>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {importStatus.categories.map((cat) => (
              <div key={cat.label} className="rounded-md bg-xp-bg/50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-xp-text">{cat.label}</span>
                  <span className="text-[10px] text-xp-text-secondary font-mono">
                    {cat.keys.length} key{cat.keys.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-xp-text-secondary/70 font-mono leading-relaxed">
                  {cat.keys.join(', ')}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 mb-4">
            <AlertTriangle size={14} className="shrink-0 text-amber-400" />
            <span className="text-xs text-amber-400/90">
              This will overwrite your current settings. The page will reload to apply changes.
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelImport}
              className="px-3 py-1.5 rounded-md text-sm border border-xp-border bg-xp-surface text-xp-text hover:bg-xp-surface-light transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyImport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-xp-accent text-white hover:opacity-90 transition-opacity"
            >
              <CheckCircle size={14} />
              Apply Import
            </button>
          </div>
        </div>
      )}

      {importStatus.type === 'success' && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <CheckCircle size={16} className="shrink-0 text-emerald-400" />
          <div>
            <div className="text-sm font-medium text-emerald-400">Import Successful</div>
            <div className="text-xs text-emerald-400/80 mt-0.5">
              Restored {importStatus.count} setting{importStatus.count !== 1 ? 's' : ''}.
              Reloading...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BackupRestoreSettings;
