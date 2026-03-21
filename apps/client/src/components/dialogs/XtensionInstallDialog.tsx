import React, { useState } from 'react';
import { Package, Shield, X, Download, Loader2 } from 'lucide-react';

interface XtensionInstallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: {
    id: string;
    name: string;
    display_name?: string;
    description?: string;
    version: string;
    author: string;
    permissions?: string[];
  } | null;
  onInstall: () => Promise<void>;
}

const PERMISSION_LABELS: Record<string, string> = {
  'file:read': 'Read files on your system',
  'file:write': 'Write and modify files',
  'ui:panels': 'Add panels to the interface',
  'ui:notifications': 'Show notifications',
  'native:invoke': 'Execute native code',
  'network:fetch': 'Make network requests',
};

const XtensionInstallDialog = ({
  isOpen,
  onClose,
  manifest,
  onInstall,
}: XtensionInstallDialogProps) => {
  const [installing, setInstalling] = useState(false);

  if (!isOpen || !manifest) return null;

  const displayName = manifest.display_name || manifest.name;
  const permissions = manifest.permissions || [];

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await onInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="bg-xp-bg border-xp-border relative w-[420px] max-w-[90vw] overflow-hidden rounded-lg border shadow-2xl">
        {/* Header */}
        <div className="border-xp-border flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-xp-blue/20 border-xp-blue/30 flex h-10 w-10 items-center justify-center rounded-lg border">
              <Package className="text-xp-blue h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xp-text text-sm font-semibold">Install Extension</h2>
              <p className="text-xp-text-muted text-xs">.xtension package</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-5 py-4">
          {/* Extension info */}
          <div className="space-y-1">
            <h3 className="text-xp-text text-base font-medium">{displayName}</h3>
            <p className="text-xp-text-muted text-xs">
              v{manifest.version} by {manifest.author}
            </p>
            {manifest.description && (
              <p className="text-xp-text-secondary mt-2 text-sm">{manifest.description}</p>
            )}
          </div>

          {/* Permissions */}
          {permissions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xp-text-muted flex items-center gap-1.5 text-xs font-medium">
                <Shield className="h-3.5 w-3.5" />
                Requested Permissions
              </div>
              <div className="bg-xp-surface border-xp-border space-y-1.5 rounded-md border p-3">
                {permissions.map((perm) => (
                  <div key={perm} className="flex items-center gap-2 text-xs">
                    <div className="bg-xp-yellow h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                    <span className="text-xp-text">{PERMISSION_LABELS[perm] || perm}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-xp-border bg-xp-surface/50 flex items-center justify-end gap-2 border-t px-5 py-3">
          <button
            onClick={onClose}
            disabled={installing}
            className="border-xp-border bg-xp-surface text-xp-text hover:bg-xp-surface-light rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="bg-xp-blue hover:bg-xp-blue/80 flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white transition-colors disabled:opacity-50"
          >
            {installing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Install Extension
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default XtensionInstallDialog;
