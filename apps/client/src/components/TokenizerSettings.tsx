import React, { useState, useEffect } from 'react';
import { TauriAPI, TokenizerSettings, TokenIndex, IndexingProgress } from '@/lib/tauri-api';
import { useToast } from '@/hooks/use-toast';

interface TokenizerSettingsProps {
  className?: string;
}

export default function TokenizerSettingsComponent({ className }: TokenizerSettingsProps) {
  const [settings, setSettings] = useState<TokenizerSettings>({
    enabled: false,
    whitelisted_paths: [],
    blacklisted_extensions: [],
    blacklisted_paths: [],
    max_file_size: 10 * 1024 * 1024, // 10MB
    update_interval: 300, // 5 minutes
    memory_limit_mb: 1024, // 1 GB
  });

  const [stats, setStats] = useState<TokenIndex | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgress | null>(null);
  const [newPath, setNewPath] = useState('');
  const [newBlacklistPath, setNewBlacklistPath] = useState('');
  const [newExtension, setNewExtension] = useState('');
  const [autoWhitelist, setAutoWhitelist] = useState(() => {
    const saved = localStorage.getItem('xplorer:auto-whitelist-visited');
    return saved !== null ? saved === 'true' : true; // default ON
  });
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();

  const loadSettings = async () => {
    try {
      const tokenizerSettings = await TauriAPI.getTokenizerSettings();
      setSettings(tokenizerSettings);
    } catch (error) {
      console.error('Failed to load tokenizer settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tokenizer settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const tokenizerStats = await TauriAPI.getTokenizerStats();
      setStats(tokenizerStats);
    } catch (error) {
      console.error('Failed to load tokenizer stats:', error);
    }
  };

  const checkIndexingStatus = async () => {
    try {
      const indexing = await TauriAPI.isTokenizerIndexing();
      setIsIndexing(indexing);
    } catch (error) {
      console.error('Failed to check indexing status:', error);
    }
  };

  useEffect(() => {
    loadSettings();
    loadStats();
    checkIndexingStatus();

    // Listen for indexing progress
    const unlisten = TauriAPI.listenToEvent<IndexingProgress>('tokenizer-progress', (progress) => {
      setIndexingProgress(progress);
      if (progress.status === 'Completed') {
        setIsIndexing(false);
        loadStats();
        toast({
          title: 'Indexing Complete',
          description: `Indexed ${progress.processed_files} files with ${progress.total_tokens} tokens`,
        });
      }
    });

    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
    // Mount-only: loadSettings and toast are stable and only needed on init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async () => {
    try {
      await TauriAPI.setTokenizerSettings(settings);
      toast({
        title: 'Settings Saved',
        description: 'Tokenizer settings have been updated',
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tokenizer settings',
        variant: 'destructive',
      });
    }
  };

  const addWhitelistedPath = () => {
    if (newPath.trim() && !settings.whitelisted_paths.includes(newPath.trim())) {
      setSettings((prev) => ({
        ...prev,
        whitelisted_paths: [...prev.whitelisted_paths, newPath.trim()],
      }));
      setNewPath('');
    }
  };

  const removeWhitelistedPath = (path: string) => {
    setSettings((prev) => ({
      ...prev,
      whitelisted_paths: prev.whitelisted_paths.filter((p) => p !== path),
    }));
  };

  const addBlacklistedExtension = () => {
    if (
      newExtension.trim() &&
      !settings.blacklisted_extensions.includes(newExtension.trim().toLowerCase())
    ) {
      setSettings((prev) => ({
        ...prev,
        blacklisted_extensions: [...prev.blacklisted_extensions, newExtension.trim().toLowerCase()],
      }));
      setNewExtension('');
    }
  };

  const removeBlacklistedExtension = (extension: string) => {
    setSettings((prev) => ({
      ...prev,
      blacklisted_extensions: prev.blacklisted_extensions.filter((ext) => ext !== extension),
    }));
  };

  const addBlacklistedPath = () => {
    if (newBlacklistPath.trim() && !settings.blacklisted_paths.includes(newBlacklistPath.trim())) {
      setSettings((prev) => ({
        ...prev,
        blacklisted_paths: [...prev.blacklisted_paths, newBlacklistPath.trim()],
      }));
      setNewBlacklistPath('');
    }
  };

  const removeBlacklistedPath = (path: string) => {
    setSettings((prev) => ({
      ...prev,
      blacklisted_paths: prev.blacklisted_paths.filter((p) => p !== path),
    }));
  };

  const toggleAutoWhitelist = (value: boolean) => {
    setAutoWhitelist(value);
    localStorage.setItem('xplorer:auto-whitelist-visited', String(value));
  };

  const handleRebuildIndex = async () => {
    try {
      await TauriAPI.rebuildTokenIndex();
      setIsIndexing(true);
      setIndexingProgress(null);
      toast({
        title: 'Indexing Started',
        description: 'Background indexing has been initiated',
      });
    } catch (error) {
      console.error('Failed to start indexing:', error);
      toast({
        title: 'Error',
        description: 'Failed to start indexing',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className || ''}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xp-blue"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-xp-text">File Tokenizer</h2>
          <p className="text-sm text-xp-text-muted">
            Index file contents for lightning-fast search and AI integration
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {stats && (
            <div className="text-xs text-xp-text-muted">
              {stats.total_files} files, {stats.total_tokens.toLocaleString()} tokens
            </div>
          )}
          <div
            className={`w-3 h-3 rounded-full ${settings.enabled ? 'bg-green-500' : 'bg-gray-400'}`}
          ></div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-xp-surface rounded-lg border border-xp-border">
        <div>
          <h3 className="font-medium text-xp-text">Enable File Indexing</h3>
          <p className="text-sm text-xp-text-muted">
            Automatically index whitelisted directories for fast search
          </p>
        </div>
        <button
          onClick={() => setSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
          className={`px-4 py-2 rounded-md transition-colors ${
            settings.enabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {settings.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Auto-whitelist visited folders */}
      <div className="flex items-center justify-between p-4 bg-xp-surface rounded-lg border border-xp-border">
        <div>
          <h3 className="font-medium text-xp-text">Auto-whitelist visited folders</h3>
          <p className="text-sm text-xp-text-muted">
            Automatically add every folder you navigate to the whitelist for indexing
          </p>
        </div>
        <button
          onClick={() => toggleAutoWhitelist(!autoWhitelist)}
          className={`px-4 py-2 rounded-md transition-colors ${
            autoWhitelist
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {autoWhitelist ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Indexing Status & Progress */}
      {(isIndexing || indexingProgress) && (
        <div className="p-4 bg-xp-surface rounded-lg border border-xp-border">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <h3 className="font-medium text-xp-text">
              {isIndexing ? 'Indexing in Progress' : 'Indexing Complete'}
            </h3>
          </div>

          {indexingProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-xp-text-muted">
                  {indexingProgress.processed_files} / {indexingProgress.total_files} files
                </span>
                <span className="text-xp-text">
                  {indexingProgress.progress_percentage.toFixed(1)}%
                </span>
              </div>

              <div className="w-full bg-xp-bg rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${indexingProgress.progress_percentage}%` }}
                ></div>
              </div>

              <div className="text-xs text-xp-text-muted">
                Current: {indexingProgress.current_file}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="p-4 bg-xp-surface rounded-lg border border-xp-border">
          <h3 className="font-medium text-xp-text mb-3">Index Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-xp-blue">{stats.total_files}</div>
              <div className="text-xs text-xp-text-muted">Files Indexed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-xp-blue">
                {stats.total_tokens.toLocaleString()}
              </div>
              <div className="text-xs text-xp-text-muted">Total Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-xp-blue">
                {Object.keys(stats.word_to_files || {}).length.toLocaleString()}
              </div>
              <div className="text-xs text-xp-text-muted">Unique Words</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-xp-blue">
                {stats.last_updated
                  ? new Date(stats.last_updated * 1000).toLocaleDateString()
                  : 'Never'}
              </div>
              <div className="text-xs text-xp-text-muted">Last Updated</div>
            </div>
          </div>
        </div>
      )}

      {/* Whitelisted Paths */}
      <div className="p-4 bg-xp-surface rounded-lg border border-xp-border">
        <h3 className="font-medium text-xp-text mb-3">Whitelisted Directories</h3>
        <p className="text-xs text-xp-text-muted mb-3">
          Only files in these directories will be indexed. Add absolute paths to directories you
          trust.
        </p>

        <div className="space-y-2 mb-3">
          {settings.whitelisted_paths.map((path, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-xp-bg rounded">
              <span className="text-sm font-mono">{path}</span>
              <button
                onClick={() => removeWhitelistedPath(path)}
                className="text-red-500 hover:text-red-400 p-1"
                title="Remove path"
              >
                ×
              </button>
            </div>
          ))}

          {settings.whitelisted_paths.length === 0 && (
            <div className="text-center py-4 text-xp-text-muted">
              No directories whitelisted. Add directories to enable indexing.
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWhitelistedPath()}
            placeholder="Enter directory path (e.g., /home/user/projects)"
            className="flex-1 px-3 py-2 bg-xp-bg border border-xp-border rounded text-sm"
          />
          <button
            onClick={addWhitelistedPath}
            className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark text-sm"
          >
            Add
          </button>
        </div>
      </div>

      {/* Blacklisted Extensions */}
      <div className="p-4 bg-xp-surface rounded-lg border border-xp-border">
        <h3 className="font-medium text-xp-text mb-3">Blacklisted Extensions</h3>
        <p className="text-xs text-xp-text-muted mb-3">
          Files with these extensions will be skipped during indexing.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {settings.blacklisted_extensions.map((ext, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 bg-xp-bg text-sm rounded"
            >
              .{ext}
              <button
                onClick={() => removeBlacklistedExtension(ext)}
                className="ml-2 text-red-500 hover:text-red-400"
                title="Remove extension"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            value={newExtension}
            onChange={(e) => setNewExtension(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBlacklistedExtension()}
            placeholder="Extension (e.g., exe, dll, jpg)"
            className="flex-1 px-3 py-2 bg-xp-bg border border-xp-border rounded text-sm"
          />
          <button
            onClick={addBlacklistedExtension}
            className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark text-sm"
          >
            Add
          </button>
        </div>
      </div>

      {/* Blacklisted Paths */}
      <div className="p-4 bg-xp-surface rounded-lg border border-xp-border">
        <h3 className="font-medium text-xp-text mb-3">Blacklisted Directories</h3>
        <p className="text-xs text-xp-text-muted mb-3">
          Directories in this list will never be indexed, even with auto-whitelist enabled.
        </p>

        <div className="space-y-2 mb-3">
          {(settings.blacklisted_paths || []).map((path, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-xp-bg rounded">
              <span className="text-sm font-mono">{path}</span>
              <button
                onClick={() => removeBlacklistedPath(path)}
                className="text-red-500 hover:text-red-400 p-1"
                title="Remove path"
              >
                &times;
              </button>
            </div>
          ))}

          {(!settings.blacklisted_paths || settings.blacklisted_paths.length === 0) && (
            <div className="text-center py-4 text-xp-text-muted">No directories blacklisted.</div>
          )}
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            value={newBlacklistPath}
            onChange={(e) => setNewBlacklistPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBlacklistedPath()}
            placeholder="Enter directory path to exclude (e.g., C:\Windows)"
            className="flex-1 px-3 py-2 bg-xp-bg border border-xp-border rounded text-sm"
          />
          <button
            onClick={addBlacklistedPath}
            className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark text-sm"
          >
            Add
          </button>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="p-4 bg-xp-surface rounded-lg border border-xp-border">
        <h3 className="font-medium text-xp-text mb-3">Advanced Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Max File Size: {formatFileSize(settings.max_file_size)}
            </label>
            <input
              type="range"
              min={1024 * 1024} // 1MB
              max={100 * 1024 * 1024} // 100MB
              step={1024 * 1024}
              value={settings.max_file_size}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, max_file_size: parseInt(e.target.value) }))
              }
              className="w-full"
            />
            <div className="text-xs text-xp-text-muted mt-1">
              Files larger than this will be skipped
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Update Interval: {formatDuration(settings.update_interval)}
            </label>
            <input
              type="range"
              min={60} // 1 minute
              max={3600} // 1 hour
              step={60}
              value={settings.update_interval}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, update_interval: parseInt(e.target.value) }))
              }
              className="w-full"
            />
            <div className="text-xs text-xp-text-muted mt-1">
              How often to check for file changes
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Memory Limit:{' '}
              {settings.memory_limit_mb >= 1024
                ? `${(settings.memory_limit_mb / 1024).toFixed(settings.memory_limit_mb % 1024 === 0 ? 0 : 1)} GB`
                : `${settings.memory_limit_mb} MB`}
            </label>
            <input
              type="range"
              min={256}
              max={4096}
              step={256}
              value={settings.memory_limit_mb}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, memory_limit_mb: parseInt(e.target.value) }))
              }
              className="w-full"
            />
            <div className="text-xs text-xp-text-muted mt-1">
              Maximum RAM the search index can use. Indexing stops when this limit is reached.
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          onClick={saveSettings}
          className="flex-1 px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors"
        >
          Save Settings
        </button>

        <button
          onClick={handleRebuildIndex}
          disabled={isIndexing || !settings.enabled || settings.whitelisted_paths.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isIndexing ? 'Indexing...' : 'Rebuild Index'}
        </button>

        <button
          onClick={() => {
            const defaults: TokenizerSettings = {
              enabled: true,
              whitelisted_paths: [],
              blacklisted_extensions: [
                'exe',
                'dll',
                'so',
                'dylib',
                'bin',
                'obj',
                'zip',
                'tar',
                'gz',
                'rar',
                '7z',
                'iso',
                'jpg',
                'jpeg',
                'png',
                'gif',
                'bmp',
                'tiff',
                'mp4',
                'avi',
                'mov',
                'wmv',
                'flv',
                'mkv',
                'mp3',
                'wav',
                'flac',
                'aac',
                'ogg',
                'wma',
                'doc',
                'ppt',
                'xls',
              ],
              blacklisted_paths: [],
              max_file_size: 10 * 1024 * 1024,
              update_interval: 300,
              memory_limit_mb: 1024,
            };
            setSettings(defaults);
            toggleAutoWhitelist(true);
            toast({
              title: 'Reset',
              description: 'Settings restored to defaults. Click Save to apply.',
            });
          }}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
