import React, { useState, useEffect, useCallback } from 'react';
import { TauriAPI } from '@/lib/tauri-api';
import { extensionHost } from '@/lib/extension-host';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  ExternalLink,
  RefreshCw,
  Package,
  Loader2,
  AlertCircle,
  Inbox,
  FolderOpen,
  Check,
  Download,
  Trash2,
} from 'lucide-react';
import ExtensionDetailDialog from './ExtensionDetailDialog';
import { BUILTIN_CATEGORIES } from '@/data/builtin-extensions';
import { EXTENSION_PACKS, type ExtensionPack } from '@/data/extension-packs';
import ExtensionCard from './marketplace/ExtensionCard';
import MarketplaceFilters from './marketplace/MarketplaceFilters';
import MarketplacePagination from './marketplace/MarketplacePagination';

const DEFAULT_MARKETPLACE_API = 'http://localhost:3000/api';

const getMarketplaceApi = () : string => {
  try {
    const saved = localStorage.getItem('xplorer:marketplace-url');
    const url = saved || DEFAULT_MARKETPLACE_API;
    // CRIT-05: Enforce HTTPS for remote (non-localhost) marketplace URLs
    // to prevent man-in-the-middle attacks on extension downloads.
    if (
      !url.startsWith('http://localhost') &&
      !url.startsWith('http://127.0.0.1') &&
      !url.startsWith('https://')
    ) {
      console.warn(
        '[Security] Marketplace URL must use HTTPS for remote servers. Falling back to default.',
      );
      return DEFAULT_MARKETPLACE_API;
    }
    return url;
  } catch {
    return DEFAULT_MARKETPLACE_API;
  }
}

export interface MarketplaceExtension {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  description: string;
  version: string;
  checksum: string;
  icon: string | null;
  downloadCount: number;
  averageRating: number;
  reviewCount: number;
  author: {
    username: string;
    name: string | null;
  };
  categories: Array<{ name: string; slug: string }>;
  downloadUrl: string;
  permissions?: string[];
  isInstalled?: boolean;
}

interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortOption = 'popular' | 'recent' | 'rating';

const MarketplacePanel = () => {
  const { toast } = useToast();

  // Data state
  const [extensions, setExtensions] = useState<MarketplaceExtension[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [view, setView] = useState<'extensions' | 'packs'>('packs');
  const [installingPackId, setInstallingPackId] = useState<string | null>(null);

  // Detail dialog
  const [selectedExtension, setSelectedExtension] = useState<MarketplaceExtension | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load installed extensions and categories on mount
  useEffect(() => {
    loadInstalledExtensions();
    loadCategories();
    loadExtensions(1);
  }, []);

  // Reload extensions when filters change
  useEffect(() => {
    loadExtensions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedCategory, sortBy]);

  const loadCategories = async () => {
    try {
      const response = await fetch(`${getMarketplaceApi()}/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || data);
        return;
      }
    } catch {
      // Remote marketplace not available
    }
    setCategories(BUILTIN_CATEGORIES);
  };

  const loadInstalledExtensions = async () => {
    try {
      const installed = await TauriAPI.getInstalledExtensions();
      setInstalledExtensions(installed.map((ext) => ext.manifest.id));
    } catch (err) {
      console.error('Failed to load installed extensions:', err);
    }
  };

  const loadExtensions = useCallback(
    async (page: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (selectedCategory) params.set('category', selectedCategory);
        params.set('sort', sortBy);
        params.set('page', String(page));
        params.set('limit', '20');

        const response = await fetch(`${getMarketplaceApi()}/extensions?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        const data = await response.json();
        setExtensions(data.extensions || []);
        setPagination(
          data.pagination || {
            page,
            limit: 20,
            total: data.extensions?.length || 0,
            totalPages: 1,
          },
        );
      } catch {
        setError(
          'Marketplace is currently unavailable. Already-installed extensions continue to work offline.',
        );
        setExtensions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedSearch, selectedCategory, sortBy],
  );

  const handleInstall = async (extension: MarketplaceExtension) => {
    setInstallingId(extension.id);
    try {
      const downloadUrl = `${getMarketplaceApi()}/extensions/${extension.id}/download`;
      const pkg = await TauriAPI.downloadAndInstallExtension(
        downloadUrl,
        extension.id,
        extension.checksum,
      );
      await extensionHost.loadExtension(pkg);
      await extensionHost.activateExtension(pkg.manifest.id);
      setInstalledExtensions((prev) => [...prev, extension.id]);
      toast({
        title: 'Installed',
        description: `${extension.displayName} installed successfully`,
      });
    } catch (err) {
      toast({
        title: 'Install Failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setInstallingId(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadExtensions(newPage);
    }
  };

  const handleInstallFromFile = async () => {
    try {
      const files = await TauriAPI.showOpenDialog({
        multiple: false,
        filters: [{ name: 'Xplorer Extension', extensions: ['xtension'] }],
      });
      if (!files || files.length === 0) return;

      const xtensionPath = files[0];
      setInstallingId('__file__');
      const pkg = await TauriAPI.installXtensionFile(xtensionPath);
      await extensionHost.loadExtension(pkg);
      await extensionHost.activateExtension(pkg.manifest.id);
      setInstalledExtensions((prev) => [...prev, pkg.manifest.id]);
      toast({
        title: 'Installed',
        description: `${pkg.manifest.display_name || pkg.manifest.name} installed successfully`,
      });
      loadExtensions(pagination.page);
    } catch (err) {
      toast({
        title: 'Install Failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstall = async (extension: MarketplaceExtension) => {
    setInstallingId(extension.id);
    try {
      await extensionHost.uninstallExtension(extension.id);
      setInstalledExtensions((prev) => prev.filter((id) => id !== extension.id));
      toast({
        title: 'Uninstalled',
        description: `${extension.displayName} removed successfully`,
      });
    } catch (err) {
      toast({
        title: 'Uninstall Failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setInstallingId(null);
    }
  };

  const handleInstallPack = async (pack: ExtensionPack) => {
    setInstallingPackId(pack.id);
    let installed = 0;
    const failedIds: string[] = [];

    for (const extId of pack.extensions) {
      if (installedExtensions.includes(extId)) continue;

      try {
        const downloadUrl = `${getMarketplaceApi()}/extensions/${extId}/download`;
        const pkg = await TauriAPI.downloadAndInstallExtension(downloadUrl, extId, '');
        await extensionHost.loadExtension(pkg);
        await extensionHost.activateExtension(pkg.manifest.id);
        setInstalledExtensions((prev) => [...prev, extId]);
        installed++;
      } catch (err) {
        console.error(`Failed to install ${extId}:`, err);
        failedIds.push(extId);
      }
    }

    setInstallingPackId(null);

    if (installed > 0) {
      toast({
        title: `${pack.name} installed`,
        description: `${installed} extension${installed > 1 ? 's' : ''} installed${failedIds.length > 0 ? ` (failed: ${failedIds.join(', ')})` : ''}`,
      });
    } else if (failedIds.length > 0) {
      toast({
        title: 'Install Failed',
        description: `Could not install: ${failedIds.join(', ')}`,
        variant: 'destructive',
      });
    }
  };

  const handleUninstallPack = async (pack: ExtensionPack) => {
    setInstallingPackId(pack.id);
    let removed = 0;
    const failedIds: string[] = [];

    for (const extId of pack.extensions) {
      if (!installedExtensions.includes(extId)) continue;

      try {
        await extensionHost.uninstallExtension(extId);
        setInstalledExtensions((prev) => prev.filter((id) => id !== extId));
        removed++;
      } catch (err) {
        console.error(`Failed to uninstall ${extId}:`, err);
        failedIds.push(extId);
      }
    }

    setInstallingPackId(null);

    if (removed > 0) {
      toast({
        title: `${pack.name} uninstalled`,
        description: `${removed} extension${removed > 1 ? 's' : ''} removed${failedIds.length > 0 ? ` (failed: ${failedIds.join(', ')})` : ''}`,
      });
    } else if (failedIds.length > 0) {
      toast({
        title: 'Uninstall Failed',
        description: `Could not remove: ${failedIds.join(', ')}`,
        variant: 'destructive',
      });
    }
  };

  const getPackStatus = (pack: ExtensionPack) => {
    const total = pack.extensions.length;
    const installedCount = pack.extensions.filter((id) => installedExtensions.includes(id)).length;
    return { total, installedCount, isFullyInstalled: installedCount === total };
  };

  return (
    <div className="flex flex-col h-full w-full bg-xp-bg text-xp-text overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-xp-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-xp-blue" />
          Extension Marketplace
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleInstallFromFile}
            disabled={!!installingId}
            className="p-1.5 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
            title="Install from .xtension file"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => loadExtensions(pagination.page)}
            disabled={isLoading}
            className="p-1.5 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => window.open('http://localhost:3000', '_blank')}
            className="p-1.5 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
            title="Open Marketplace Website"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-xp-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-xp-text-muted" />
          <input
            type="text"
            placeholder="Search extensions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-xp-surface border border-xp-border rounded-md text-sm text-xp-text placeholder:text-xp-text-muted focus:outline-none focus:border-xp-blue transition-colors"
          />
        </div>
      </div>

      {/* View Toggle: Packs | Extensions */}
      <div className="flex border-b border-xp-border">
        <button
          onClick={() => setView('packs')}
          className={`flex-1 py-1.5 text-xs font-medium text-center transition-colors ${
            view === 'packs'
              ? 'text-xp-blue border-b-2 border-xp-blue'
              : 'text-xp-text-muted hover:text-xp-text'
          }`}
        >
          Extension Packs
        </button>
        <button
          onClick={() => setView('extensions')}
          className={`flex-1 py-1.5 text-xs font-medium text-center transition-colors ${
            view === 'extensions'
              ? 'text-xp-blue border-b-2 border-xp-blue'
              : 'text-xp-text-muted hover:text-xp-text'
          }`}
        >
          All Extensions
        </button>
      </div>

      {view === 'extensions' && (
        <>
          {/* Category filters + Sort */}
          <MarketplaceFilters
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            sortBy={sortBy}
            setSortBy={setSortBy}
            pagination={pagination}
          />
        </>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'packs' ? (
          <div className="p-3 space-y-3">
            {EXTENSION_PACKS.map((pack) => {
              const { total, installedCount, isFullyInstalled } = getPackStatus(pack);
              const isInstalling = installingPackId === pack.id;
              return (
                <div
                  key={pack.id}
                  className="border border-xp-border rounded-lg p-3 hover:bg-xp-surface-light/50 transition-colors"
                  style={{ background: 'rgba(var(--xp-surface-rgb, 30,30,46), 0.5)' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(var(--xp-blue-rgb, 122,162,247), 0.15)' }}
                    >
                      <svg className="w-5 h-5 text-xp-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d={pack.iconPath} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">{pack.name}</h4>
                        {pack.recommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-xp-blue/20 text-xp-blue font-medium">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-xp-text-muted mt-0.5">{pack.description}</p>
                      <p className="text-[11px] text-xp-text-muted mt-1">
                        {installedCount}/{total} extensions installed
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isFullyInstalled ? (
                        <button
                          onClick={() => handleUninstallPack(pack)}
                          disabled={isInstalling || !!installingPackId}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors bg-xp-red/20 text-xp-red hover:bg-xp-red/30"
                        >
                          {isInstalling ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Removing...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              Uninstall
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleInstallPack(pack)}
                            disabled={isInstalling || !!installingPackId}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                              isInstalling
                                ? 'bg-xp-blue/20 text-xp-blue cursor-wait'
                                : 'bg-xp-blue text-white hover:bg-xp-blue/80'
                            }`}
                          >
                            {isInstalling ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Installing...
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                {installedCount > 0 ? 'Install Rest' : 'Install Pack'}
                              </>
                            )}
                          </button>
                          {installedCount > 0 && (
                            <button
                              onClick={() => handleUninstallPack(pack)}
                              disabled={isInstalling || !!installingPackId}
                              className="flex items-center p-1.5 rounded text-xs transition-colors text-xp-text-muted hover:text-xp-red hover:bg-xp-red/10"
                              title="Uninstall pack"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Loader2 className="h-6 w-6 text-xp-blue animate-spin" />
            <span className="text-xs text-xp-text-muted">Loading extensions...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 px-4">
            <AlertCircle className="h-6 w-6 text-xp-red" />
            <span className="text-xs text-xp-text-muted text-center">
              Failed to load extensions
            </span>
            <span className="text-xs text-xp-red text-center break-all">{error}</span>
            <button
              onClick={() => loadExtensions(1)}
              className="mt-1 px-3 py-1 text-xs bg-xp-surface border border-xp-border rounded hover:bg-xp-surface-light text-xp-text transition-colors"
            >
              Retry
            </button>
          </div>
        ) : extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Inbox className="h-6 w-6 text-xp-text-muted" />
            <span className="text-xs text-xp-text-muted">No extensions found</span>
            {(debouncedSearch || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                }}
                className="text-xs text-xp-blue hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {extensions.map((extension) => (
              <ExtensionCard
                key={extension.id}
                extension={extension}
                isInstalled={installedExtensions.includes(extension.id)}
                isInstalling={installingId === extension.id}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onSelect={(ext) => {
                  setSelectedExtension(ext);
                  setShowDetail(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination (extensions view only) */}
      {view === 'extensions' && (
        <MarketplacePagination
          pagination={pagination}
          isLoading={isLoading}
          onPageChange={handlePageChange}
        />
      )}

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-xp-border">
        <button
          onClick={() => window.open('http://localhost:3000/publish', '_blank')}
          className="w-full text-xs text-xp-blue hover:text-xp-blue/80 text-center transition-colors"
        >
          Publish Your Extension
        </button>
      </div>

      {/* Extension Detail Dialog */}
      <ExtensionDetailDialog
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        extension={selectedExtension}
        isInstalled={selectedExtension ? installedExtensions.includes(selectedExtension.id) : false}
        isInstalling={selectedExtension ? installingId === selectedExtension.id : false}
        onInstall={handleInstall}
      />
    </div>
  );
}

export default MarketplacePanel;
