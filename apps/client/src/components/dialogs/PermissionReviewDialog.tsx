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
      <DialogContent className="bg-xp-bg border-xp-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xp-text flex items-center gap-2">
            <Puzzle className="text-xp-blue h-5 w-5" />
            Review Extension
          </DialogTitle>
        </DialogHeader>

        {/* Extension Info */}
        <div className="bg-xp-surface border-xp-border flex items-start gap-3 rounded-lg border p-3">
          <div className="bg-xp-blue/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Package className="text-xp-blue h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xp-text truncate text-sm font-medium">
              {manifest.display_name || manifest.name}
            </div>
            <div className="text-xp-text-muted mt-0.5 flex items-center gap-2 text-xs">
              <span>v{manifest.version}</span>
              <span className="opacity-40">|</span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {manifest.author}
              </span>
            </div>
            {manifest.description && (
              <p className="text-xp-text-muted mt-1.5 line-clamp-2 text-xs">
                {manifest.description}
              </p>
            )}
          </div>
        </div>

        {/* Signature Status */}
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
            verified
              ? 'bg-xp-green/10 text-xp-green border-xp-green/30 border'
              : 'bg-xp-orange/10 text-xp-orange border-xp-orange/30 border'
          }`}
        >
          {verified ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              Verified — Signature matches
            </>
          ) : (
            <>
              <ShieldQuestion className="h-4 w-4" />
              Unsigned — This extension has not been verified
            </>
          )}
        </div>

        {/* Permissions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xp-text text-xs font-semibold uppercase tracking-wider">
              Permissions ({permissions.length})
            </h4>
            {hasDanger && (
              <span className="text-xp-red flex items-center gap-1 text-xs">
                <ShieldAlert className="h-3 w-3" />
                {counts.danger} dangerous
              </span>
            )}
          </div>

          {permissions.length === 0 ? (
            <div className="text-xp-text-muted bg-xp-surface border-xp-border rounded-lg border p-3 text-center text-xs">
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
                      className={`flex items-start gap-2.5 rounded-lg border p-2 ${colors.bg} ${colors.border}`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colors.text}`} />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium ${colors.text}`}>{perm.label}</div>
                        <div className="text-xp-text-muted text-xs">{perm.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Summary + Buttons */}
        <div className="border-xp-border flex items-center justify-between border-t pt-2">
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
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {installing ? 'Installing...' : 'Install & Activate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionReviewDialog;
