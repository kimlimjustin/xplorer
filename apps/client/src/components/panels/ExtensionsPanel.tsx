import React, { useState, useEffect, useCallback } from 'react';
import { extensionHost, resolveIcon } from '@/lib/extension-host';
import { TauriAPI, type ExtensionManifestInfo } from '@/lib/tauri-api';
import { AgentService } from '@/lib/agent-service';
import { useToast } from '@/hooks/use-toast';
import { Bot } from 'lucide-react';
import PermissionReviewDialog from '@/components/dialogs/PermissionReviewDialog';

interface Theme {
  name: string;
  primary: string;
  bg: string;
  surface: string;
  text: string;
}

interface ExtensionsPanelProps {
  themes: Record<string, Theme>;
  theme: string;
  applyTheme: (themeKey: string) => void;
}

const ExtensionsPanel = ({ themes, theme, applyTheme }: ExtensionsPanelProps) => {
  const { toast } = useToast();
  const [, forceUpdate] = useState(0);
  const [installing, setInstalling] = useState(false);
  const [pendingInstall, setPendingInstall] = useState<{
    path: string;
    manifest: ExtensionManifestInfo;
  } | null>(null);

  // Agent enabled state — single source synced with AgentService backend
  const [agentEnabled, setAgentEnabled] = useState(false);
  useEffect(() => {
    AgentService.getSettings()
      .then((s) => setAgentEnabled(s.enabled))
      .catch((err) => console.warn('Failed to load agent settings:', err));
  }, []);

  const toggleAgent = useCallback(() => {
    setAgentEnabled((prev) => {
      const next = !prev;
      AgentService.getSettings()
        .then((s) => AgentService.updateSettings({ ...s, enabled: next }))
        .catch((err) => console.error('Failed to update agent settings:', err));
      return next;
    });
  }, []);

  // Listen for extension host changes
  useEffect(() => {
    const unsubscribe = extensionHost.onChange(() => {
      forceUpdate((n) => n + 1);
    });
    return unsubscribe;
  }, []);

  const allExtensions = extensionHost.getAllExtensions();

  const handleToggleExtension = useCallback(async (id: string) => {
    const ext = extensionHost.getExtension(id);
    if (!ext) return;

    if (ext.isActive) {
      await extensionHost.deactivateExtension(id);
    } else {
      await extensionHost.activateExtension(id);
    }
  }, []);

  const handleUninstall = useCallback(async (id: string) => {
    try {
      await extensionHost.unloadExtension(id);
      await TauriAPI.uninstallExtensionById(id);
    } catch (err) {
      console.error('Failed to uninstall extension:', err);
      toast({
        variant: 'destructive',
        title: 'Uninstall Failed',
        description: `Failed to uninstall extension: ${err}`,
      });
    }
  }, [toast]);

  const handleInstallFromFolder = useCallback(async () => {
    try {
      const result = await TauriAPI.showOpenDialog({ directory: true });
      if (!result || result.length === 0) return;

      const path = result[0];
      const manifest = await TauriAPI.validateExtensionPath(path);
      setPendingInstall({ path, manifest });
    } catch (err) {
      console.error('Failed to validate extension:', err);
      toast({
        variant: 'destructive',
        title: 'Validation Failed',
        description: `Failed to validate extension: ${err}`,
      });
    }
  }, [toast]);

  const handleApproveInstall = useCallback(async () => {
    if (!pendingInstall) return;
    try {
      setInstalling(true);
      const pkg = await TauriAPI.installExtensionFromPath(pendingInstall.path);
      await extensionHost.loadExtension(pkg);
      await extensionHost.activateExtension(pkg.manifest.id);
    } catch (err) {
      console.error('Failed to install extension:', err);
      toast({
        variant: 'destructive',
        title: 'Install Failed',
        description: `Failed to install extension: ${err}`,
      });
    } finally {
      setInstalling(false);
      setPendingInstall(null);
    }
  }, [pendingInstall, toast]);

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h3 className="text-xs font-semibold text-xp-text uppercase tracking-wider mb-4">
        Extensions
      </h3>

      {/* Claude Agent Extension — hardcoded system feature */}
      <div className="mb-4">
        <div className="p-3 bg-xp-bg rounded-lg border border-xp-border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium flex items-center">
              <Bot size={16} className="mr-2 inline-block" />
              Claude Agent
            </h4>
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${agentEnabled ? 'bg-xp-purple' : 'bg-xp-border'}`}
              ></div>
              <button
                onClick={toggleAgent}
                aria-label={agentEnabled ? 'Disable Claude Agent' : 'Enable Claude Agent'}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  agentEnabled
                    ? 'bg-xp-purple bg-opacity-80 text-white hover:bg-opacity-100'
                    : 'bg-xp-border text-xp-text hover:bg-xp-surface-light'
                }`}
              >
                {agentEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
          <p className="text-xs text-xp-text-muted">Autonomous AI agent powered by Claude.</p>
        </div>
      </div>

      {/* Theme Manager */}
      <div className="mb-4 p-3 bg-xp-bg rounded-lg border border-xp-border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Theme Manager</h4>
          <div className="w-2 h-2 bg-xp-green rounded-full"></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(themes).map(([key, themeData]) => (
            <button
              key={key}
              onClick={() => applyTheme(key)}
              aria-label={`Apply ${themeData.name} theme`}
              aria-pressed={theme === key}
              className={`text-left p-2 rounded text-xs transition-colors ${
                theme === key
                  ? 'bg-xp-blue bg-opacity-20 text-xp-blue border border-xp-blue'
                  : 'hover:bg-xp-surface-light'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: themeData.primary }}
                ></div>
                <span>{themeData.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Installed Extensions */}
      {allExtensions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-xp-text uppercase tracking-wider mb-2">
            Installed Extensions ({allExtensions.length})
          </h4>
          <div className="space-y-1.5">
            {allExtensions.map((ext) => (
              <div
                key={ext.id}
                className="flex items-center justify-between p-2 rounded hover:bg-xp-surface-light transition-colors group"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="text-base flex-shrink-0">{resolveIcon(ext.manifest.icon)}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-xp-text truncate">
                      {ext.manifest.display_name || ext.manifest.name}
                    </p>
                    <p className="text-xs text-xp-text-muted">
                      v{ext.manifest.version} by {ext.manifest.author}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleExtension(ext.id)}
                    aria-label={
                      ext.isActive
                        ? `Disable ${ext.manifest.display_name || ext.manifest.name}`
                        : `Enable ${ext.manifest.display_name || ext.manifest.name}`
                    }
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      ext.isActive
                        ? 'bg-xp-green bg-opacity-20 text-xp-green'
                        : 'bg-xp-border text-xp-text-muted'
                    }`}
                  >
                    {ext.isActive ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => handleUninstall(ext.id)}
                    aria-label={`Uninstall ${ext.manifest.display_name || ext.manifest.name}`}
                    className="px-2 py-0.5 text-xs rounded text-xp-red opacity-0 group-hover:opacity-100 hover:bg-xp-red hover:bg-opacity-10 transition-all"
                  >
                    Uninstall
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Install Extension */}
      <div className="border-t border-xp-border pt-3">
        <button
          onClick={handleInstallFromFolder}
          disabled={installing}
          aria-label="Install extension from folder"
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-xp-blue text-white rounded text-sm font-medium hover:bg-opacity-90 disabled:opacity-50 transition-colors"
        >
          {installing ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>+ Install from Folder</span>
          )}
        </button>
      </div>

      <PermissionReviewDialog
        isOpen={!!pendingInstall}
        onClose={() => setPendingInstall(null)}
        manifest={pendingInstall?.manifest ?? null}
        onApprove={handleApproveInstall}
        installing={installing}
      />
    </div>
  );
}

export default ExtensionsPanel;
