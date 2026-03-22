import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TauriAPI } from '@/lib/tauri-api';
import { extensionHost } from '@/lib/extension-host';
import { useToast } from '@/hooks/use-toast';
import {
  requiresConsentDialog,
  requestPermissionConsent,
} from '@/components/dialogs/ExtensionPermissionDialog';
import {
  Search,
  ExternalLink,
  RefreshCw,
  Package,
  Loader2,
  AlertCircle,
  Inbox,
  FolderOpen,
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

const getMarketplaceApi = (): string => {
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
};

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

interface ExtensionsContentProps {
  isLoading: boolean;
  error: string | null;
  extensions: MarketplaceExtension[];
  installedExtensions: string[];
  installingId: string | null;
  debouncedSearch: string;
  selectedCategory: string;
  handleInstall: (ext: MarketplaceExtension) => void;
  handleUninstall: (extension: MarketplaceExtension) => void;
  loadExtensions: (page: number) => void;
  setSearchTerm: (term: string) => void;
  setSelectedCategory: (cat: string) => void;
  setSelectedExtension: (ext: MarketplaceExtension) => void;
  setShowDetail: (show: boolean) => void;
}

const ExtensionsContent = ({
  isLoading,
  error,
  extensions,
  installedExtensions,
  installingId,
  debouncedSearch,
  selectedCategory,
  handleInstall,
  handleUninstall,
  loadExtensions,
  setSearchTerm,
  setSelectedCategory,
  setSelectedExtension,
  setShowDetail,
}: ExtensionsContentProps) => {
  if (isLoading) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2">
        <Loader2 className="text-xp-blue h-6 w-6 animate-spin" />
        <span className="text-xp-text-muted text-xs">Loading extensions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 px-4">
        <AlertCircle className="text-xp-red h-6 w-6" />
        <span className="text-xp-text-muted text-center text-xs">Failed to load extensions</span>
        <span className="text-xp-red break-all text-center text-xs">{error}</span>
        <button
          onClick={() => loadExtensions(1)}
          className="bg-xp-surface border-xp-border hover:bg-xp-surface-light text-xp-text mt-1 rounded border px-3 py-1 text-xs transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (extensions.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2">
        <Inbox className="text-xp-text-muted h-6 w-6" />
        <span className="text-xp-text-muted text-xs">No extensions found</span>
        {(debouncedSearch || selectedCategory) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('');
            }}
            className="text-xp-blue text-xs hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {extensions.map((extension) => (
        <ExtensionCard
          key={extension.id}
          extension={extension}
          isInstalled={
            installedExtensions.includes(extension.id) ||
            installedExtensions.includes(extension.slug)
          }
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
  );
};

const MarketplacePanel = () => {
  const { t } = useTranslation();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const perms = extension.permissions ?? [];

    if (requiresConsentDialog(perms)) {
      const granted = await requestPermissionConsent({
        extensionId: extension.id,
        extensionName: extension.name,
        displayName: extension.displayName,
        version: extension.version,
        author: extension.author.name ?? extension.author.username,
        permissions: perms,
      });

      if (!granted) {
        toast({
          title: t('permissions.cancelledTitle'),
          description: t('permissions.cancelledDesc'),
          variant: 'destructive',
        });
        return;
      }
    }

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
      // Track by manifest ID (matches slug and what loadInstalledExtensions uses)
      setInstalledExtensions((prev) => [...prev, pkg.manifest.id]);
      toast({
        title: 'Installed',
        description: `${extension.displayName} installed successfully`,
      });
    } catch (err) {
      console.error('[Marketplace] Install failed:', extension.id, err);
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
      // Use slug (matches manifest ID on disk) rather than marketplace CUID
      await extensionHost.uninstallExtension(extension.slug || extension.id);
      setInstalledExtensions((prev) =>
        prev.filter((id) => id !== extension.id && id !== extension.slug),
      );
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
    // Collect permissions from any pack extensions already known from the marketplace listing
    const toInstall = pack.extensions.filter((id) => !installedExtensions.includes(id));
    const packPerms = toInstall.flatMap((extId) => {
      const known = extensions.find((e) => e.id === extId || e.slug === extId);
      return known?.permissions ?? [];
    });
    const uniquePackPerms = [...new Set(packPerms)];

    if (requiresConsentDialog(uniquePackPerms)) {
      const granted = await requestPermissionConsent({
        extensionId: pack.id,
        extensionName: pack.id,
        displayName: pack.name,
        version: '1.0.0',
        author: 'Xplorer',
        permissions: uniquePackPerms,
      });

      if (!granted) {
        toast({
          title: t('permissions.cancelledTitle'),
          description: t('permissions.cancelledDesc'),
          variant: 'destructive',
        });
        return;
      }
    }

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
    <div className="bg-xp-bg text-xp-text flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-xp-border flex items-center justify-between border-b px-3 py-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Package className="text-xp-blue h-4 w-4" />
          Extension Marketplace
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleInstallFromFile}
            disabled={!!installingId}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors"
            title="Install from .xtension file"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => loadExtensions(pagination.page)}
            disabled={isLoading}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => window.open('http://localhost:3000', '_blank')}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors"
            title="Open Marketplace Website"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-xp-border border-b px-3 py-2">
        <div className="relative">
          <Search className="text-xp-text-muted absolute left-2.5 top-2 h-4 w-4" />
          <input
            type="text"
            placeholder="Search extensions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-xp-surface border-xp-border text-xp-text placeholder:text-xp-text-muted focus:border-xp-blue w-full rounded-md border py-1.5 pl-9 pr-3 text-sm transition-colors focus:outline-none"
          />
        </div>
      </div>

      {/* View Toggle: Packs | Extensions */}
      <div className="border-xp-border flex border-b">
        <button
          onClick={() => setView('packs')}
          className={`flex-1 py-1.5 text-center text-xs font-medium transition-colors ${
            view === 'packs'
              ? 'text-xp-blue border-xp-blue border-b-2'
              : 'text-xp-text-muted hover:text-xp-text'
          }`}
        >
          Extension Packs
        </button>
        <button
          onClick={() => setView('extensions')}
          className={`flex-1 py-1.5 text-center text-xs font-medium transition-colors ${
            view === 'extensions'
              ? 'text-xp-blue border-xp-blue border-b-2'
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
          <div className="space-y-3 p-3">
            {EXTENSION_PACKS.map((pack) => {
              const { total, installedCount, isFullyInstalled } = getPackStatus(pack);
              const isInstalling = installingPackId === pack.id;
              return (
                <div
                  key={pack.id}
                  className="border-xp-border hover:bg-xp-surface-light/50 rounded-lg border p-3 transition-colors"
                  style={{ background: 'rgba(var(--xp-surface-rgb, 30,30,46), 0.5)' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'rgba(var(--xp-blue-rgb, 122,162,247), 0.15)' }}
                    >
                      <svg
                        className="text-xp-blue h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={pack.iconPath} />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-medium">{pack.name}</h4>
                        {pack.recommended && (
                          <span className="bg-xp-blue/20 text-xp-blue rounded px-1.5 py-0.5 text-[10px] font-medium">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xp-text-muted mt-0.5 text-xs">{pack.description}</p>
                      <p className="text-xp-text-muted mt-1 text-[11px]">
                        {installedCount}/{total} extensions installed
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {isFullyInstalled ? (
                        <button
                          onClick={() => handleUninstallPack(pack)}
                          disabled={isInstalling || !!installingPackId}
                          className="bg-xp-red/20 text-xp-red hover:bg-xp-red/30 flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          {isInstalling ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Removing...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-3.5 w-3.5" />
                              Uninstall
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleInstallPack(pack)}
                            disabled={isInstalling || !!installingPackId}
                            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                              isInstalling
                                ? 'bg-xp-blue/20 text-xp-blue cursor-wait'
                                : 'bg-xp-blue hover:bg-xp-blue/80 text-white'
                            }`}
                          >
                            {isInstalling ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Installing...
                              </>
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5" />
                                {installedCount > 0 ? 'Install Rest' : 'Install Pack'}
                              </>
                            )}
                          </button>
                          {installedCount > 0 && (
                            <button
                              onClick={() => handleUninstallPack(pack)}
                              disabled={isInstalling || !!installingPackId}
                              className="text-xp-text-muted hover:text-xp-red hover:bg-xp-red/10 flex items-center rounded p-1.5 text-xs transition-colors"
                              title="Uninstall pack"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        ) : (
          <ExtensionsContent
            isLoading={isLoading}
            error={error}
            extensions={extensions}
            installedExtensions={installedExtensions}
            installingId={installingId}
            debouncedSearch={debouncedSearch}
            selectedCategory={selectedCategory}
            handleInstall={handleInstall}
            handleUninstall={handleUninstall}
            loadExtensions={loadExtensions}
            setSearchTerm={setSearchTerm}
            setSelectedCategory={setSelectedCategory}
            setSelectedExtension={setSelectedExtension}
            setShowDetail={setShowDetail}
          />
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
      <div className="border-xp-border border-t px-3 py-1.5">
        <button
          onClick={() => window.open('http://localhost:3000/publish', '_blank')}
          className="text-xp-blue hover:text-xp-blue/80 w-full text-center text-xs transition-colors"
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
};

export default MarketplacePanel;
