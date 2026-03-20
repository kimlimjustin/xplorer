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
      <div className="relative bg-xp-bg border border-xp-border rounded-lg shadow-2xl w-[420px] max-w-[90vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-xp-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-xp-blue/20 border border-xp-blue/30 flex items-center justify-center">
              <Package className="h-5 w-5 text-xp-blue" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-xp-text">Install Extension</h2>
              <p className="text-xs text-xp-text-muted">.xtension package</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Extension info */}
          <div className="space-y-1">
            <h3 className="text-base font-medium text-xp-text">{displayName}</h3>
            <p className="text-xs text-xp-text-muted">
              v{manifest.version} by {manifest.author}
            </p>
            {manifest.description && (
              <p className="text-sm text-xp-text-secondary mt-2">{manifest.description}</p>
            )}
          </div>

          {/* Permissions */}
          {permissions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-xp-text-muted">
                <Shield className="h-3.5 w-3.5" />
                Requested Permissions
              </div>
              <div className="bg-xp-surface border border-xp-border rounded-md p-3 space-y-1.5">
                {permissions.map((perm) => (
                  <div key={perm} className="flex items-center gap-2 text-xs">
                    <div className="h-1.5 w-1.5 rounded-full bg-xp-yellow flex-shrink-0" />
                    <span className="text-xp-text">{PERMISSION_LABELS[perm] || perm}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-xp-border bg-xp-surface/50">
          <button
            onClick={onClose}
            disabled={installing}
            className="px-4 py-2 text-sm rounded-md border border-xp-border bg-xp-surface text-xp-text hover:bg-xp-surface-light transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="px-4 py-2 text-sm rounded-md bg-xp-blue hover:bg-xp-blue/80 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
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
}

export default XtensionInstallDialog;
