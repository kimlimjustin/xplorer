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

  const handleUninstall = useCallback(
    async (id: string) => {
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
    },
    [toast],
  );

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
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-xp-text mb-4 text-xs font-semibold uppercase tracking-wider">
        Extensions
      </h3>

      {/* Claude Agent Extension — hardcoded system feature */}
      <div className="mb-4">
        <div className="bg-xp-bg border-xp-border rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center text-sm font-medium">
              <Bot size={16} className="mr-2 inline-block" />
              Claude Agent
            </h4>
            <div className="flex items-center space-x-2">
              <div
                className={`h-2 w-2 rounded-full ${agentEnabled ? 'bg-xp-purple' : 'bg-xp-border'}`}
              />
              <button
                onClick={toggleAgent}
                aria-label={agentEnabled ? 'Disable Claude Agent' : 'Enable Claude Agent'}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  agentEnabled
                    ? 'bg-xp-purple bg-opacity-80 text-white hover:bg-opacity-100'
                    : 'bg-xp-border text-xp-text hover:bg-xp-surface-light'
                }`}
              >
                {agentEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
          <p className="text-xp-text-muted text-xs">Autonomous AI agent powered by Claude.</p>
        </div>
      </div>

      {/* Theme Manager */}
      <div className="bg-xp-bg border-xp-border mb-4 rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium">Theme Manager</h4>
          <div className="bg-xp-green h-2 w-2 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(themes).map(([key, themeData]) => (
            <button
              key={key}
              onClick={() => applyTheme(key)}
              aria-label={`Apply ${themeData.name} theme`}
              aria-pressed={theme === key}
              className={`rounded p-2 text-left text-xs transition-colors ${
                theme === key
                  ? 'bg-xp-blue text-xp-blue border-xp-blue border bg-opacity-20'
                  : 'hover:bg-xp-surface-light'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: themeData.primary }}
                />
                <span>{themeData.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Installed Extensions */}
      {allExtensions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xp-text mb-2 text-xs font-semibold uppercase tracking-wider">
            Installed Extensions ({allExtensions.length})
          </h4>
          <div className="space-y-1.5">
            {allExtensions.map((ext) => (
              <div
                key={ext.id}
                className="hover:bg-xp-surface-light group flex items-center justify-between rounded p-2 transition-colors"
              >
                <div className="flex min-w-0 items-center space-x-2">
                  <span className="flex-shrink-0 text-base">{resolveIcon(ext.manifest.icon)}</span>
                  <div className="min-w-0">
                    <p className="text-xp-text truncate text-sm">
                      {ext.manifest.display_name || ext.manifest.name}
                    </p>
                    <p className="text-xp-text-muted text-xs">
                      v{ext.manifest.version} by {ext.manifest.author}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center space-x-1">
                  <button
                    onClick={() => handleToggleExtension(ext.id)}
                    aria-label={
                      ext.isActive
                        ? `Disable ${ext.manifest.display_name || ext.manifest.name}`
                        : `Enable ${ext.manifest.display_name || ext.manifest.name}`
                    }
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      ext.isActive
                        ? 'bg-xp-green text-xp-green bg-opacity-20'
                        : 'bg-xp-border text-xp-text-muted'
                    }`}
                  >
                    {ext.isActive ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => handleUninstall(ext.id)}
                    aria-label={`Uninstall ${ext.manifest.display_name || ext.manifest.name}`}
                    className="text-xp-red hover:bg-xp-red rounded px-2 py-0.5 text-xs opacity-0 transition-all hover:bg-opacity-10 group-hover:opacity-100"
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
      <div className="border-xp-border border-t pt-3">
        <button
          onClick={handleInstallFromFolder}
          disabled={installing}
          aria-label="Install extension from folder"
          className="bg-xp-blue flex w-full items-center justify-center space-x-2 rounded px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-opacity-90 disabled:opacity-50"
        >
          {installing ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
};

export default ExtensionsPanel;
