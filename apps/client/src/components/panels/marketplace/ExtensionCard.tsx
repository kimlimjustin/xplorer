import React from 'react';
import { Download, Star, Loader2, Trash2 } from 'lucide-react';
import { renderIcon } from '@/lib/utils';
import type { MarketplaceExtension } from '../MarketplacePanel';

interface ExtensionCardProps {
  extension: MarketplaceExtension;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (extension: MarketplaceExtension) => void;
  onUninstall: (extension: MarketplaceExtension) => void;
  onSelect: (extension: MarketplaceExtension) => void;
}

const renderStars = (rating: number) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`h-3 w-3 ${
          i <= Math.round(rating) ? 'text-xp-yellow fill-xp-yellow' : 'text-xp-text-muted'
        }`}
      />,
    );
  }
  return stars;
}

const ExtensionCard = React.memo(function ExtensionCard({
  extension,
  isInstalled,
  isInstalling,
  onInstall,
  onUninstall,
  onSelect,
}: ExtensionCardProps) {
  return (
    <div
      className="px-3 py-2.5 border-b border-xp-border/50 hover:bg-xp-surface-light/50 cursor-pointer transition-colors"
      onClick={() => onSelect(extension)}
    >
      <div className="flex items-start gap-2 min-w-0">
        <div className="flex-shrink-0 h-8 w-8 rounded-md bg-xp-surface border border-xp-border flex items-center justify-center text-xp-blue">
          {extension.icon ? (
            renderIcon(extension.icon, 16)
          ) : (
            <span className="text-sm font-semibold">
              {extension.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-xp-text truncate">{extension.displayName}</h4>
            <div className="flex-shrink-0">
              {isInstalled ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUninstall(extension);
                  }}
                  disabled={isInstalling}
                  className="px-2 py-0.5 text-[11px] bg-xp-red/20 hover:bg-xp-red/30 text-xp-red border border-xp-red/30 rounded disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Removing
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3" />
                      Uninstall
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInstall(extension);
                  }}
                  disabled={isInstalling}
                  className="px-2 py-0.5 text-[11px] bg-xp-blue hover:bg-xp-blue/80 text-white rounded disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Installing
                    </>
                  ) : (
                    'Install'
                  )}
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-xp-text-muted truncate">
            {extension.author.name || extension.author.username} &middot; v{extension.version}
          </p>

          <p className="text-xs text-xp-text-muted mt-1 line-clamp-2">{extension.description}</p>

          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-0.5 text-[11px] text-xp-text-muted">
              <Download className="h-3 w-3 flex-shrink-0" />
              {extension.downloadCount.toLocaleString()}
            </span>
            <span className="flex items-center gap-0.5 text-[11px] text-xp-text-muted">
              {renderStars(extension.averageRating)}
              <span className="ml-0.5">{extension.averageRating.toFixed(1)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ExtensionCard;
