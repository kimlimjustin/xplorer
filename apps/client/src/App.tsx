import React, { useEffect, useState, useCallback } from 'react';
import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import ExplorerUnified from '@/pages/xplorer';
import NotFound from '@/pages/not-found';
import { TauriAPI } from '@/lib/tauri-api';
import { extensionHost } from '@/lib/extension-host';
import { useToast } from '@/hooks/use-toast';
import XtensionInstallDialog from '@/components/dialogs/XtensionInstallDialog';
import './styles/tokyo-night.css';

// Lazy-loaded pages -- Settings is only needed when navigating to /settings
const Settings = React.lazy(() => import('@/pages/settings'));

const Router = () => {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen bg-xp-bg text-xp-text text-sm">Loading...</div>}>
      <Switch>
        <Route path="/" component={ExplorerUnified} />
        <Route path="/explorer" component={ExplorerUnified} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </React.Suspense>
  );
}

const XtensionFileHandler = () => {
  const { toast } = useToast();
  const [pendingXtension, setPendingXtension] = useState<{
    path: string;
    manifest: {
      id: string;
      name: string;
      display_name?: string;
      description?: string;
      version: string;
      author: string;
      permissions?: string[];
    } | null;
  } | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    TauriAPI.listenToEvent<string>('xtension-file-opened', async (xtensionPath) => {
      try {
        const manifest = await TauriAPI.inspectXtensionFile(xtensionPath);
        setPendingXtension({ path: xtensionPath, manifest });
      } catch (err) {
        toast({
          title: 'Invalid Extension',
          description: String(err),
          variant: 'destructive',
        });
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => {
      unlisten?.();
    };
  }, [toast]);

  const handleInstall = useCallback(async () => {
    if (!pendingXtension) return;
    try {
      const pkg = await TauriAPI.installXtensionFile(pendingXtension.path);
      await extensionHost.loadExtension(pkg);
      await extensionHost.activateExtension(pkg.manifest.id);
      toast({
        title: 'Extension Installed',
        description: `${pkg.manifest.display_name || pkg.manifest.name} v${pkg.manifest.version} installed successfully`,
      });
    } catch (err) {
      toast({
        title: 'Install Failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setPendingXtension(null);
    }
  }, [pendingXtension, toast]);

  if (!pendingXtension) return null;

  return (
    <XtensionInstallDialog
      isOpen={!!pendingXtension}
      onClose={() => setPendingXtension(null)}
      manifest={pendingXtension.manifest}
      onInstall={handleInstall}
    />
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <XtensionFileHandler />
    </QueryClientProvider>
  );
}

export default App;
