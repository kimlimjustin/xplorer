import { useState, useEffect } from 'react';
import { History, FolderOpen, Plus, Trash2, Save } from 'lucide-react';
import { SectionTitle, SettingRow, Toggle, Divider, SelectField } from './shared';
import { TauriAPI, type VersioningConfig } from '@/lib/tauri-api';

export default function VersioningSettings() {
  const [config, setConfig] = useState<VersioningConfig>({
    enabled_dirs: [],
    max_versions_per_file: 10,
    auto_version_on_save: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDir, setNewDir] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await TauriAPI.getVersioningConfig();
      setConfig(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    try {
      await TauriAPI.updateVersioningConfig(config);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const addDirectory = async () => {
    const dir = newDir.trim();
    if (!dir) return;
    const normalized = dir.replace(/\\/g, '/');
    if (config.enabled_dirs.some((d) => d.replace(/\\/g, '/') === normalized)) return;

    try {
      await TauriAPI.enableVersioning(dir);
      setConfig((prev) => ({
        ...prev,
        enabled_dirs: [...prev.enabled_dirs, dir],
      }));
      setNewDir('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeDirectory = async (dir: string) => {
    try {
      await TauriAPI.disableVersioning(dir);
      setConfig((prev) => ({
        ...prev,
        enabled_dirs: prev.enabled_dirs.filter((d) => d !== dir),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-xp-accent border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-xp-text-secondary">Loading versioning settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <SectionTitle
        title="File Versioning"
        description="Automatically keep previous versions of files in tracked directories"
      />

      {error && (
        <div className="mx-4 mb-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <SettingRow
        icon={Save}
        label="Auto-version on save"
        description="Automatically create a version snapshot when files in tracked directories are modified"
      >
        <Toggle
          id="auto-version"
          checked={config.auto_version_on_save}
          onChange={(v) => {
            setConfig((prev) => ({ ...prev, auto_version_on_save: v }));
            setDirty(true);
          }}
        />
      </SettingRow>

      <SettingRow
        icon={History}
        label="Max versions per file"
        description="Oldest versions are automatically deleted when this limit is exceeded"
      >
        <SelectField
          value={String(config.max_versions_per_file)}
          onChange={(v) => {
            setConfig((prev) => ({ ...prev, max_versions_per_file: parseInt(v, 10) }));
            setDirty(true);
          }}
          options={[
            { value: '5', label: '5' },
            { value: '10', label: '10' },
            { value: '20', label: '20' },
            { value: '50', label: '50' },
            { value: '100', label: '100' },
          ]}
        />
      </SettingRow>

      {dirty && (
        <div className="px-4 pb-2">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-xp-accent/10 text-xp-accent hover:bg-xp-accent/20 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      <Divider />

      <SectionTitle
        title="Tracked Directories"
        description="Only files inside these directories will have versioning enabled"
      />

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newDir}
            onChange={(e) => setNewDir(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addDirectory();
            }}
            placeholder="Enter directory path..."
            className="flex-1 h-9 px-3 text-sm rounded-md border border-xp-border bg-xp-bg text-xp-text placeholder:text-xp-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-xp-accent"
          />
          <button
            onClick={addDirectory}
            disabled={!newDir.trim()}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium bg-xp-accent/10 text-xp-accent hover:bg-xp-accent/20 transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {config.enabled_dirs.length === 0 ? (
        <div className="px-4 py-4 text-center">
          <FolderOpen size={24} className="mx-auto text-xp-text-secondary/40 mb-2" />
          <p className="text-xs text-xp-text-secondary">No directories tracked</p>
          <p className="text-[11px] text-xp-text-secondary/60 mt-0.5">
            Add a directory path above to start tracking file versions
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-1 pb-2">
          {config.enabled_dirs.map((dir) => (
            <div
              key={dir}
              className="flex items-center justify-between gap-2 rounded-md px-3 py-2 bg-xp-surface/50 border border-xp-border/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen size={14} className="shrink-0 text-xp-text-secondary" />
                <span className="text-xs text-xp-text truncate" title={dir}>
                  {dir}
                </span>
              </div>
              <button
                onClick={() => removeDirectory(dir)}
                className="flex items-center justify-center w-6 h-6 rounded-md text-xp-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0"
                title="Stop tracking this directory"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
