import React from 'react';
import { X, Download, Star, ExternalLink, Shield, Loader2, User, Tag } from 'lucide-react';
import type { MarketplaceExtension } from './MarketplacePanel';

interface ExtensionDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  extension: MarketplaceExtension | null;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (extension: MarketplaceExtension) => void;
}

const ExtensionDetailDialog = ({
  isOpen,
  onClose,
  extension,
  isInstalled,
  isInstalling,
  onInstall,
}: ExtensionDetailDialogProps) => {
  if (!isOpen || !extension) return null;

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= Math.round(rating) ? 'text-xp-yellow fill-xp-yellow' : 'text-xp-text-muted'
          }`}
        />,
      );
    }
    return stars;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-xp-surface border-xp-border flex max-h-[80vh] w-[480px] max-w-[90vw] flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-xp-border flex items-start justify-between border-b p-5">
          <div className="flex min-w-0 items-start gap-3">
            {/* Icon */}
            <div className="bg-xp-bg border-xp-border flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border text-lg">
              {extension.icon ? (
                <span>{extension.icon}</span>
              ) : (
                <span className="text-xp-blue text-xl font-bold">
                  {extension.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-xp-text truncate text-lg font-semibold">
                {extension.displayName}
              </h2>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xp-text-muted flex items-center gap-1 text-xs">
                  <User className="h-3 w-3" />
                  {extension.author.name || extension.author.username}
                </span>
                <span className="text-xp-text-muted text-xs">&middot;</span>
                <span className="text-xp-text-muted text-xs">v{extension.version}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text flex-shrink-0 rounded p-1 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Stats row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {renderStars(extension.averageRating)}
              <span className="text-xp-text ml-1 text-sm">
                {extension.averageRating.toFixed(1)}
              </span>
              <span className="text-xp-text-muted text-xs">
                ({extension.reviewCount} review{extension.reviewCount !== 1 ? 's' : ''})
              </span>
            </div>
            <span className="text-xp-text-muted flex items-center gap-1 text-sm">
              <Download className="h-4 w-4" />
              {extension.downloadCount.toLocaleString()} downloads
            </span>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xp-text mb-1.5 text-sm font-medium">Description</h3>
            <p className="text-xp-text-muted text-sm leading-relaxed">{extension.description}</p>
          </div>

          {/* Categories */}
          {extension.categories && extension.categories.length > 0 && (
            <div>
              <h3 className="text-xp-text mb-1.5 flex items-center gap-1 text-sm font-medium">
                <Tag className="h-3.5 w-3.5" />
                Categories
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {extension.categories.map((cat) => (
                  <span
                    key={cat.slug}
                    className="bg-xp-blue/10 text-xp-blue border-xp-blue/20 rounded-full border px-2 py-0.5 text-xs"
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Permissions */}
          {extension.permissions && extension.permissions.length > 0 && (
            <div>
              <h3 className="text-xp-text mb-1.5 flex items-center gap-1 text-sm font-medium">
                <Shield className="h-3.5 w-3.5" />
                Permissions
              </h3>
              <div className="space-y-1">
                {extension.permissions.map((perm) => (
                  <div
                    key={perm}
                    className="bg-xp-bg border-xp-border text-xp-text-muted flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs"
                  >
                    <Shield className="text-xp-yellow h-3 w-3 flex-shrink-0" />
                    {perm}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-xp-border flex items-center justify-between border-t p-4">
          <button
            onClick={() => {
              const baseUrl = (
                localStorage.getItem('xplorer:marketplace-url') || 'http://localhost:3000/api'
              ).replace(/\/api$/, '');
              window.open(`${baseUrl}/extensions/${extension.slug || extension.id}`, '_blank');
            }}
            className="text-xp-text-muted hover:text-xp-text border-xp-border hover:bg-xp-surface-light flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Web
          </button>

          {isInstalled ? (
            <span className="bg-xp-green/20 text-xp-green border-xp-green/30 rounded-md border px-4 py-1.5 text-sm">
              Installed
            </span>
          ) : (
            <button
              onClick={() => onInstall(extension)}
              disabled={isInstalling}
              className="bg-xp-blue hover:bg-xp-blue/80 flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm text-white transition-colors disabled:opacity-50"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Install
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExtensionDetailDialog;
