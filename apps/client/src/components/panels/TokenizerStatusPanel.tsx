import React, { useState, useEffect } from 'react';
import {
  TauriAPI,
  type TokenIndex,
  type TokenizerSettings,
  type SearchResult,
  type AIIndexStatus,
} from '@/lib/tauri-api';
import { AgentService } from '@/lib/agent-service';
import { useToast } from '@/hooks/use-toast';
import { TOKENIZER_PANEL_REFRESH_MS } from '@/lib/constants';

const TokenizerStatusPanel = () => {
  const [stats, setStats] = useState<TokenIndex | null>(null);
  const [settings, setSettings] = useState<TokenizerSettings | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIIndexStatus | null>(null);
  const [aiProvider, setAiProvider] = useState<'ollama' | 'claude' | 'openai'>('ollama');
  const { toast } = useToast();

  /** Read API key from settings (Claude from AgentService, OpenAI from localStorage). */
  const getApiKey = async (provider: 'claude' | 'openai'): Promise<string | undefined> => {
    if (provider === 'claude') {
      try {
        const s = await AgentService.getSettings();
        return s.api_key || undefined;
      } catch {
        return undefined;
      }
    }
    return localStorage.getItem('xplorer_openai_key') || undefined;
  };

  const loadStats = async () => {
    try {
      const [tokenizerStats, tokenizerSettings, indexingStatus] = await Promise.all([
        TauriAPI.getTokenizerStats(),
        TauriAPI.getTokenizerSettings(),
        TauriAPI.isTokenizerIndexing(),
      ]);
      setStats(tokenizerStats);
      setSettings(tokenizerSettings);
      setIsIndexing(indexingStatus);

      // Try loading AI index status (may fail if Ollama isn't running)
      try {
        const aiIndexStatus = await TauriAPI.getAIIndexStatus();
        setAiStatus(aiIndexStatus);
      } catch {
        // AI indexing not available
      }
    } catch (error) {
      console.error('Failed to load tokenizer stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, TOKENIZER_PANEL_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const handleRebuildIndex = async () => {
    try {
      await TauriAPI.rebuildTokenIndex();
      toast({
        title: 'Rebuilding Index',
        description: 'Token index is being rebuilt in the background',
      });
      setIsIndexing(true);
      // Refresh stats after a short delay
      setTimeout(loadStats, 1000);
    } catch (error) {
      toast({
        title: 'Rebuild Failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  const handleTriggerAIIndexing = async () => {
    if (!settings?.whitelisted_paths?.length) {
      toast({
        title: 'No Paths',
        description: 'Add indexed paths first before triggering AI indexing.',
        variant: 'destructive',
      });
      return;
    }

    let apiKey: string | undefined;
    if (aiProvider !== 'ollama') {
      apiKey = await getApiKey(aiProvider);
      if (!apiKey) {
        toast({
          title: 'API Key Not Set',
          description: `Set your ${aiProvider === 'claude' ? 'Claude' : 'OpenAI'} API key in Settings first.`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      await TauriAPI.triggerAIIndexing(settings.whitelisted_paths, aiProvider, apiKey);
      const providerLabel = (() => {
        if (aiProvider === 'claude') return 'Claude';
        if (aiProvider === 'openai') return 'OpenAI';
        return 'Ollama';
      })();
      toast({
        title: 'AI Indexing Started',
        description: `Processing images with ${providerLabel} vision model...`,
      });
      setTimeout(loadStats, 2000);
    } catch (error) {
      toast({
        title: 'AI Indexing Failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const enhanced = await TauriAPI.enhancedSearch(searchQuery, undefined, 20);
      setSearchResults(enhanced.results);
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Get content source badge
  const getSourceBadge = (relevanceType: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      exact: { label: 'Exact', color: 'bg-xp-green' },
      semantic: { label: 'Semantic', color: 'bg-indigo-500' },
      fuzzy: { label: 'Fuzzy', color: 'bg-yellow-500' },
      metadata: { label: 'Metadata', color: 'bg-teal-500' },
      ai_description: { label: 'AI', color: 'bg-purple-500' },
    };
    return badges[relevanceType] || { label: relevanceType, color: 'bg-xp-blue' };
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="border-xp-blue mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2" />
          <p className="text-xp-text-muted text-sm">Loading tokenizer stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-xp-bg text-xp-text flex h-full flex-col">
      {/* Header */}
      <div className="border-xp-border border-b px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Search & Indexing</h3>
          {isIndexing && (
            <div className="text-xp-blue flex items-center gap-2 text-xs">
              <div className="border-xp-blue h-3 w-3 animate-spin rounded-full border-b" />
              <span>Indexing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="border-xp-border space-y-2 border-b px-4 py-3">
        <div className="flex justify-between text-sm">
          <span className="text-xp-text-muted">Status:</span>
          <span className={settings?.enabled ? 'text-xp-green' : 'text-xp-red'}>
            {settings?.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xp-text-muted">Indexed Files:</span>
          <span className="text-xp-text">{stats?.total_files?.toLocaleString() || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xp-text-muted">Metadata Files:</span>
          <span className="text-xp-text">
            {stats?.metadata_files ? Object.keys(stats.metadata_files).length.toLocaleString() : 0}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xp-text-muted">Total Tokens:</span>
          <span className="text-xp-text">{stats?.total_tokens?.toLocaleString() || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xp-text-muted">Indexed Paths:</span>
          <span className="text-xp-text">{settings?.whitelisted_paths?.length || 0}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-xp-border space-y-2 border-b px-4 py-3">
        <button
          onClick={handleRebuildIndex}
          disabled={isIndexing}
          className="bg-xp-blue hover:bg-xp-blue/80 disabled:bg-xp-surface-light disabled:text-xp-text-muted w-full rounded px-3 py-2 text-sm text-white transition-colors"
        >
          {isIndexing ? 'Rebuilding...' : 'Rebuild Index'}
        </button>
      </div>

      {/* AI Indexing Section (Phase 3) */}
      <div className="border-xp-border border-b px-4 py-3">
        <h4 className="mb-2 text-sm font-medium">AI Vision Indexing</h4>
        <div className="space-y-2">
          {/* Provider Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xp-text-muted whitespace-nowrap text-xs">Provider:</span>
            <div className="flex flex-1 gap-1">
              {(['ollama', 'claude', 'openai'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setAiProvider(p)}
                  className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                    aiProvider === p
                      ? 'bg-purple-600 text-white'
                      : 'bg-xp-surface text-xp-text-muted hover:bg-xp-surface-light'
                  }`}
                >
                  {(() => {
                    if (p === 'ollama') return 'Ollama';
                    if (p === 'claude') return 'Claude';
                    return 'OpenAI';
                  })()}
                </button>
              ))}
            </div>
          </div>

          {/* Hint for online providers */}
          {aiProvider !== 'ollama' && (
            <p className="text-xp-text-muted text-[10px]">Uses API key from Settings</p>
          )}

          {aiStatus ? (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-xp-text-muted">AI Indexed:</span>
                <span className="text-xp-text">{aiStatus.total_indexed}</span>
              </div>
              {aiStatus.vision_model && (
                <div className="flex justify-between text-xs">
                  <span className="text-xp-text-muted">Vision Model:</span>
                  <span className="text-xp-text ml-2 truncate">{aiStatus.vision_model}</span>
                </div>
              )}
              {aiStatus.is_processing && (
                <div className="flex items-center gap-2 text-xs text-purple-400">
                  <div className="h-3 w-3 animate-spin rounded-full border-b border-purple-400" />
                  <span className="truncate">
                    Processing: {aiStatus.current_file?.split(/[/\\]/).pop() || '...'}
                  </span>
                </div>
              )}
              {aiStatus.queue_length > 0 && (
                <div className="text-xp-text-muted text-xs">
                  Queue: {aiStatus.queue_length} files remaining
                </div>
              )}
              <button
                onClick={handleTriggerAIIndexing}
                disabled={aiStatus.is_processing}
                className="disabled:bg-xp-surface-light disabled:text-xp-text-muted w-full rounded bg-purple-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-purple-500"
              >
                {aiStatus.is_processing ? 'Processing...' : 'Index Images with AI'}
              </button>
            </>
          ) : null}
          {!aiStatus && aiProvider === 'ollama' && (
            <p className="text-xp-text-muted text-xs">
              Requires Ollama with a vision model (llava, bakllava, moondream)
            </p>
          )}
          {!aiStatus && aiProvider !== 'ollama' && (
            <button
              onClick={handleTriggerAIIndexing}
              disabled={!settings?.whitelisted_paths?.length}
              className="disabled:bg-xp-surface-light disabled:text-xp-text-muted w-full rounded bg-purple-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-purple-500"
            >
              Index Images with AI
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="border-xp-border border-b px-4 py-3">
        <h4 className="mb-2 text-sm font-medium">Content Search</h4>
        <p className="text-xp-text-muted mb-2 text-xs">
          Try: "large videos from last month" or "recent photos"
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            placeholder="Search files by content or metadata..."
            className="bg-xp-surface border-xp-border focus:border-xp-blue text-xp-text placeholder:text-xp-text-muted flex-1 rounded border px-3 py-2 text-sm focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="bg-xp-blue hover:bg-xp-blue/80 disabled:bg-xp-surface-light disabled:text-xp-text-muted rounded px-3 py-2 text-sm text-white transition-colors"
          >
            {isSearching ? (
              <div className="h-4 w-4 animate-spin rounded-full border-b border-white" />
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto">
        {searchResults.length > 0 ? (
          <div>
            <div className="text-xp-text-muted bg-xp-surface px-4 py-2 text-xs">
              Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </div>
            {searchResults.map((result, index) => {
              const badge = getSourceBadge(result.relevance_type);
              return (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  className="hover:bg-xp-surface-light border-xp-border/30 cursor-pointer border-b px-4 py-3 transition-colors"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="text-xp-text truncate text-sm">{result.filename}</span>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${badge.color} bg-opacity-20 text-white`}
                      >
                        {badge.label}
                      </span>
                      <span className="bg-xp-blue/20 text-xp-blue rounded px-1.5 py-0.5 text-xs">
                        {result.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xp-text-muted mb-1 truncate text-xs" title={result.path}>
                    {result.path}
                  </p>
                  {result.matches && result.matches.length > 0 && (
                    <p className="text-xp-text-muted bg-xp-surface mt-1 line-clamp-2 rounded px-2 py-1 text-xs">
                      {result.matches[0].context}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
        {searchResults.length === 0 && searchQuery && !isSearching && (
          <div className="text-xp-text-muted flex h-32 items-center justify-center text-sm">
            No results found
          </div>
        )}
      </div>

      {/* Indexed Paths List */}
      {settings &&
        settings.whitelisted_paths &&
        settings.whitelisted_paths.length > 0 &&
        !searchQuery && (
          <div className="border-xp-border border-t">
            <div className="text-xp-text-muted bg-xp-surface px-4 py-2 text-xs">
              Indexed Directories
            </div>
            <div className="max-h-32 overflow-y-auto">
              {settings.whitelisted_paths.map((path) => (
                <div
                  key={path}
                  className="text-xp-text-muted border-xp-border/30 hover:bg-xp-surface-light truncate border-b px-4 py-2 text-xs"
                  title={path}
                >
                  {path}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
};

export default TokenizerStatusPanel;
