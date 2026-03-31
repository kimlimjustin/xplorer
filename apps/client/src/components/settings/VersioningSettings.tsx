import { useState, useEffect } from 'react';
import { History, FolderOpen, Plus, Trash2, Save } from 'lucide-react';
import { SectionTitle, SettingRow, Toggle, Divider, SelectField } from './shared';
import { TauriAPI, type VersioningConfig } from '@/lib/tauri-api';

const VersioningSettings = () => {
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
        <div className="border-xp-accent h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
        <span className="text-xp-text-secondary ml-3 text-sm">Loading versioning settings...</span>
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
        <div className="mx-4 mb-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
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
            className="bg-xp-accent/10 text-xp-accent hover:bg-xp-accent/20 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
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
            className="border-xp-border bg-xp-bg text-xp-text placeholder:text-xp-text-secondary/50 focus:ring-xp-accent h-9 flex-1 rounded-md border px-3 text-sm focus:outline-none focus:ring-1"
          />
          <button
            onClick={addDirectory}
            disabled={!newDir.trim()}
            className="bg-xp-accent/10 text-xp-accent hover:bg-xp-accent/20 flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {config.enabled_dirs.length === 0 ? (
        <div className="px-4 py-4 text-center">
          <FolderOpen size={24} className="text-xp-text-secondary/40 mx-auto mb-2" />
          <p className="text-xp-text-secondary text-xs">No directories tracked</p>
          <p className="text-xp-text-secondary/60 mt-0.5 text-[11px]">
            Add a directory path above to start tracking file versions
          </p>
        </div>
      ) : (
        <div className="space-y-1 px-4 pb-2">
          {config.enabled_dirs.map((dir) => (
            <div
              key={dir}
              className="bg-xp-surface/50 border-xp-border/30 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FolderOpen size={14} className="text-xp-text-secondary shrink-0" />
                <span className="text-xp-text truncate text-xs" title={dir}>
                  {dir}
                </span>
              </div>
              <button
                onClick={() => removeDirectory(dir)}
                className="text-xp-text-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-red-500/10 hover:text-red-400"
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
};

export default VersioningSettings;
