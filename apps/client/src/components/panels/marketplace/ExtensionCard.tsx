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
};

const ExtensionCard = React.memo(
  ({
    extension,
    isInstalled,
    isInstalling,
    onInstall,
    onUninstall,
    onSelect,
  }: ExtensionCardProps) => {
    return (
      <div
        className="border-xp-border/50 hover:bg-xp-surface-light/50 cursor-pointer border-b px-3 py-2.5 transition-colors"
        onClick={() => onSelect(extension)}
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="bg-xp-surface border-xp-border text-xp-blue flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border">
            {extension.icon ? (
              renderIcon(extension.icon, 16)
            ) : (
              <span className="text-sm font-semibold">
                {extension.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xp-text truncate text-sm font-medium">{extension.displayName}</h4>
              <div className="flex-shrink-0">
                {isInstalled ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUninstall(extension);
                    }}
                    disabled={isInstalling}
                    className="bg-xp-red/20 hover:bg-xp-red/30 text-xp-red border-xp-red/30 flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-50"
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
                    className="bg-xp-blue hover:bg-xp-blue/80 flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-white transition-colors disabled:opacity-50"
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

            <p className="text-xp-text-muted truncate text-[11px]">
              {extension.author.name || extension.author.username} &middot; v{extension.version}
            </p>

            <p className="text-xp-text-muted mt-1 line-clamp-2 text-xs">{extension.description}</p>

            <div className="mt-1.5 flex items-center gap-3">
              <span className="text-xp-text-muted flex items-center gap-0.5 text-[11px]">
                <Download className="h-3 w-3 flex-shrink-0" />
                {extension.downloadCount.toLocaleString()}
              </span>
              <span className="text-xp-text-muted flex items-center gap-0.5 text-[11px]">
                {renderStars(extension.averageRating)}
                <span className="ml-0.5">{extension.averageRating.toFixed(1)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default ExtensionCard;
