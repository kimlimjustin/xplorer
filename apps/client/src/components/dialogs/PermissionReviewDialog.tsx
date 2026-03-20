import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Puzzle, User, Package } from 'lucide-react';
import type { ExtensionManifestInfo } from '@/lib/tauri-api';
import { sortPermissions, countByRisk, type RiskLevel } from '@/lib/extension-permissions';

interface PermissionReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: ExtensionManifestInfo | null;
  verified?: boolean;
  onApprove: () => void;
  installing?: boolean;
}

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  danger: { bg: 'bg-xp-red/10', text: 'text-xp-red', border: 'border-xp-red/30' },
  warning: { bg: 'bg-xp-orange/10', text: 'text-xp-orange', border: 'border-xp-orange/30' },
  safe: { bg: 'bg-xp-green/10', text: 'text-xp-green', border: 'border-xp-green/30' },
};

const PermissionReviewDialog = ({
  isOpen,
  onClose,
  manifest,
  verified,
  onApprove,
  installing = false,
}: PermissionReviewDialogProps) => {
  if (!manifest) return null;

  const permissions = manifest.permissions ?? [];
  const sorted = sortPermissions(permissions);
  const counts = countByRisk(permissions);
  const hasDanger = counts.danger > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-xp-bg border-xp-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xp-text">
            <Puzzle className="w-5 h-5 text-xp-blue" />
            Review Extension
          </DialogTitle>
        </DialogHeader>

        {/* Extension Info */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-xp-surface border border-xp-border">
          <div className="w-10 h-10 rounded-lg bg-xp-blue/20 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-xp-blue" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm text-xp-text truncate">
              {manifest.display_name || manifest.name}
            </div>
            <div className="text-xs text-xp-text-muted flex items-center gap-2 mt-0.5">
              <span>v{manifest.version}</span>
              <span className="opacity-40">|</span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {manifest.author}
              </span>
            </div>
            {manifest.description && (
              <p className="text-xs text-xp-text-muted mt-1.5 line-clamp-2">
                {manifest.description}
              </p>
            )}
          </div>
        </div>

        {/* Signature Status */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            verified
              ? 'bg-xp-green/10 text-xp-green border border-xp-green/30'
              : 'bg-xp-orange/10 text-xp-orange border border-xp-orange/30'
          }`}
        >
          {verified ? (
            <>
              <ShieldCheck className="w-4 h-4" />
              Verified — Signature matches
            </>
          ) : (
            <>
              <ShieldQuestion className="w-4 h-4" />
              Unsigned — This extension has not been verified
            </>
          )}
        </div>

        {/* Permissions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-xp-text uppercase tracking-wider">
              Permissions ({permissions.length})
            </h4>
            {hasDanger && (
              <span className="text-xs text-xp-red flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                {counts.danger} dangerous
              </span>
            )}
          </div>

          {permissions.length === 0 ? (
            <div className="text-xs text-xp-text-muted p-3 rounded-lg bg-xp-surface border border-xp-border text-center">
              This extension requests no special permissions.
            </div>
          ) : (
            <ScrollArea className="max-h-52">
              <div className="space-y-1.5">
                {sorted.map((perm) => {
                  const colors = RISK_COLORS[perm.risk];
                  const Icon = perm.icon;
                  return (
                    <div
                      key={perm.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border ${colors.bg} ${colors.border}`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colors.text}`} />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium ${colors.text}`}>{perm.label}</div>
                        <div className="text-xs text-xp-text-muted">{perm.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Summary + Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-xp-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xp-text border-xp-border hover:bg-xp-surface-light"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={installing}
            className={`gap-1.5 ${
              hasDanger
                ? 'bg-xp-orange hover:bg-xp-orange/90 text-white'
                : 'bg-xp-blue hover:bg-xp-blue/90 text-white'
            }`}
          >
            {installing ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            {installing ? 'Installing...' : 'Install & Activate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PermissionReviewDialog;
