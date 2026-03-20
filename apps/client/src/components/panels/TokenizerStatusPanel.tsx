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
      const providerLabel =
        aiProvider === 'claude' ? 'Claude' : aiProvider === 'openai' ? 'OpenAI' : 'Ollama';
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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xp-blue mx-auto mb-2"></div>
          <p className="text-sm text-xp-text-muted">Loading tokenizer stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-xp-bg text-xp-text">
      {/* Header */}
      <div className="px-4 py-3 border-b border-xp-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Search & Indexing</h3>
          {isIndexing && (
            <div className="flex items-center gap-2 text-xs text-xp-blue">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-xp-blue"></div>
              <span>Indexing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-xp-border space-y-2">
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
      <div className="px-4 py-3 border-b border-xp-border space-y-2">
        <button
          onClick={handleRebuildIndex}
          disabled={isIndexing}
          className="w-full px-3 py-2 text-sm bg-xp-blue hover:bg-xp-blue/80 disabled:bg-xp-surface-light disabled:text-xp-text-muted text-white rounded transition-colors"
        >
          {isIndexing ? 'Rebuilding...' : 'Rebuild Index'}
        </button>
      </div>

      {/* AI Indexing Section (Phase 3) */}
      <div className="px-4 py-3 border-b border-xp-border">
        <h4 className="text-sm font-medium mb-2">AI Vision Indexing</h4>
        <div className="space-y-2">
          {/* Provider Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-xp-text-muted whitespace-nowrap">Provider:</span>
            <div className="flex gap-1 flex-1">
              {(['ollama', 'claude', 'openai'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setAiProvider(p)}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                    aiProvider === p
                      ? 'bg-purple-600 text-white'
                      : 'bg-xp-surface text-xp-text-muted hover:bg-xp-surface-light'
                  }`}
                >
                  {p === 'ollama' ? 'Ollama' : p === 'claude' ? 'Claude' : 'OpenAI'}
                </button>
              ))}
            </div>
          </div>

          {/* Hint for online providers */}
          {aiProvider !== 'ollama' && (
            <p className="text-[10px] text-xp-text-muted">Uses API key from Settings</p>
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
                  <span className="text-xp-text truncate ml-2">{aiStatus.vision_model}</span>
                </div>
              )}
              {aiStatus.is_processing && (
                <div className="flex items-center gap-2 text-xs text-purple-400">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-purple-400"></div>
                  <span className="truncate">
                    Processing: {aiStatus.current_file?.split(/[/\\]/).pop() || '...'}
                  </span>
                </div>
              )}
              {aiStatus.queue_length > 0 && (
                <div className="text-xs text-xp-text-muted">
                  Queue: {aiStatus.queue_length} files remaining
                </div>
              )}
              <button
                onClick={handleTriggerAIIndexing}
                disabled={aiStatus.is_processing}
                className="w-full px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-xp-surface-light disabled:text-xp-text-muted text-white rounded transition-colors"
              >
                {aiStatus.is_processing ? 'Processing...' : 'Index Images with AI'}
              </button>
            </>
          ) : aiProvider === 'ollama' ? (
            <p className="text-xs text-xp-text-muted">
              Requires Ollama with a vision model (llava, bakllava, moondream)
            </p>
          ) : (
            <button
              onClick={handleTriggerAIIndexing}
              disabled={!settings?.whitelisted_paths?.length}
              className="w-full px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-xp-surface-light disabled:text-xp-text-muted text-white rounded transition-colors"
            >
              Index Images with AI
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-xp-border">
        <h4 className="text-sm font-medium mb-2">Content Search</h4>
        <p className="text-xs text-xp-text-muted mb-2">
          Try: "large videos from last month" or "recent photos"
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            placeholder="Search files by content or metadata..."
            className="flex-1 px-3 py-2 text-sm bg-xp-surface border border-xp-border rounded focus:outline-none focus:border-xp-blue text-xp-text placeholder:text-xp-text-muted"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-3 py-2 text-sm bg-xp-blue hover:bg-xp-blue/80 disabled:bg-xp-surface-light disabled:text-xp-text-muted text-white rounded transition-colors"
          >
            {isSearching ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b border-white"></div>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
            <div className="px-4 py-2 text-xs text-xp-text-muted bg-xp-surface">
              Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </div>
            {searchResults.map((result, index) => {
              const badge = getSourceBadge(result.relevance_type);
              return (
                <div
                  key={index}
                  className="px-4 py-3 hover:bg-xp-surface-light cursor-pointer border-b border-xp-border/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm text-xp-text truncate">{result.filename}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${badge.color} bg-opacity-20 text-white`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-xp-blue/20 text-xp-blue">
                        {result.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-xp-text-muted truncate mb-1" title={result.path}>
                    {result.path}
                  </p>
                  {result.matches && result.matches.length > 0 && (
                    <p className="text-xs text-xp-text-muted line-clamp-2 bg-xp-surface px-2 py-1 rounded mt-1">
                      {result.matches[0].context}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : searchQuery && !isSearching ? (
          <div className="flex items-center justify-center h-32 text-xp-text-muted text-sm">
            No results found
          </div>
        ) : null}
      </div>

      {/* Indexed Paths List */}
      {settings &&
        settings.whitelisted_paths &&
        settings.whitelisted_paths.length > 0 &&
        !searchQuery && (
          <div className="border-t border-xp-border">
            <div className="px-4 py-2 text-xs text-xp-text-muted bg-xp-surface">
              Indexed Directories
            </div>
            <div className="max-h-32 overflow-y-auto">
              {settings.whitelisted_paths.map((path, index) => (
                <div
                  key={index}
                  className="px-4 py-2 text-xs text-xp-text-muted border-b border-xp-border/30 truncate hover:bg-xp-surface-light"
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
}

export default TokenizerStatusPanel;
