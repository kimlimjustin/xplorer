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
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-xp-surface border border-xp-border rounded-lg w-[480px] max-w-[90vw] max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-xp-border">
          <div className="flex items-start gap-3 min-w-0">
            {/* Icon */}
            <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-xp-bg border border-xp-border flex items-center justify-center text-lg">
              {extension.icon ? (
                <span>{extension.icon}</span>
              ) : (
                <span className="text-xp-blue font-bold text-xl">
                  {extension.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-xp-text truncate">
                {extension.displayName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-xs text-xp-text-muted">
                  <User className="h-3 w-3" />
                  {extension.author.name || extension.author.username}
                </span>
                <span className="text-xs text-xp-text-muted">&middot;</span>
                <span className="text-xs text-xp-text-muted">v{extension.version}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Stats row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {renderStars(extension.averageRating)}
              <span className="text-sm text-xp-text ml-1">
                {extension.averageRating.toFixed(1)}
              </span>
              <span className="text-xs text-xp-text-muted">
                ({extension.reviewCount} review{extension.reviewCount !== 1 ? 's' : ''})
              </span>
            </div>
            <span className="flex items-center gap-1 text-sm text-xp-text-muted">
              <Download className="h-4 w-4" />
              {extension.downloadCount.toLocaleString()} downloads
            </span>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-xp-text mb-1.5">Description</h3>
            <p className="text-sm text-xp-text-muted leading-relaxed">{extension.description}</p>
          </div>

          {/* Categories */}
          {extension.categories && extension.categories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-xp-text mb-1.5 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                Categories
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {extension.categories.map((cat) => (
                  <span
                    key={cat.slug}
                    className="px-2 py-0.5 text-xs rounded-full bg-xp-blue/10 text-xp-blue border border-xp-blue/20"
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
              <h3 className="text-sm font-medium text-xp-text mb-1.5 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                Permissions
              </h3>
              <div className="space-y-1">
                {extension.permissions.map((perm) => (
                  <div
                    key={perm}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-xp-bg rounded border border-xp-border text-xs text-xp-text-muted"
                  >
                    <Shield className="h-3 w-3 text-xp-yellow flex-shrink-0" />
                    {perm}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-xp-border">
          <button
            onClick={() => {
              const baseUrl = (
                localStorage.getItem('xplorer:marketplace-url') || 'http://localhost:3000/api'
              ).replace(/\/api$/, '');
              window.open(`${baseUrl}/extensions/${extension.slug || extension.id}`, '_blank');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-xp-text-muted hover:text-xp-text rounded border border-xp-border hover:bg-xp-surface-light transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Web
          </button>

          {isInstalled ? (
            <span className="px-4 py-1.5 text-sm bg-xp-green/20 text-xp-green border border-xp-green/30 rounded-md">
              Installed
            </span>
          ) : (
            <button
              onClick={() => onInstall(extension)}
              disabled={isInstalling}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-xp-blue hover:bg-xp-blue/80 text-white rounded-md disabled:opacity-50 transition-colors"
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
}

export default ExtensionDetailDialog;
