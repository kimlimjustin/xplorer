import { transport } from '../transport';
import type {
  SearchResult,
  EnhancedSearchResult,
  AISearchResult,
  AIIndexStatus,
  AIIndexEntry,
  TokenIndex,
  FileToken,
  StructuredQuery,
  TokenizerSettings,
} from '../tauri-api-types';

// ── Basic search ────────────────────────────────────────────────────────────

export const findFiles = async (pattern: string, searchPath: string): Promise<string[]> =>
  await transport('find_files', { pattern, searchPath });

export const searchInFiles = async (
  pattern: string,
  searchPath: string,
): Promise<
  {
    file: string;
    line: number;
    content: string;
  }[]
> => await transport('search_in_files', { pattern, searchPath });

// ── Tokenizer operations ────────────────────────────────────────────────────

export const setTokenizerSettings = async (settings: TokenizerSettings): Promise<void> =>
  await transport('set_tokenizer_settings', { settings });

export const getTokenizerSettings = async (): Promise<TokenizerSettings> =>
  await transport('get_tokenizer_settings');

export const rebuildTokenIndex = async (): Promise<void> => await transport('rebuild_token_index');

export const searchTokens = async (query: string, limit?: number): Promise<SearchResult[]> =>
  await transport('search_tokens', { query, limit: limit || null });

export const naturalLanguageSearch = async (
  query: string,
  language?: string,
  limit?: number,
): Promise<SearchResult[]> =>
  await transport('natural_language_search', { query, language, limit });

export const getTokenizerStats = async (): Promise<TokenIndex | null> =>
  await transport('get_tokenizer_stats');

export const isTokenizerIndexing = async (): Promise<boolean> =>
  await transport('is_tokenizer_indexing');

export const getFileTokens = async (filePath: string): Promise<FileToken | null> =>
  await transport('get_file_tokens', { filePath });

export const addPathToTokenizer = async (path: string): Promise<void> =>
  await transport('add_path_to_tokenizer', { path });

export const getFileRecommendations = async (
  filePath: string,
  limit?: number,
): Promise<SearchResult[]> => await transport('get_file_recommendations', { filePath, limit });

// ── Auto-index a directory (called on navigation) ───────────────────────────

export const indexDirectory = async (path: string, maxDepth?: number): Promise<void> =>
  await transport('index_directory', { path, maxDepth: maxDepth || null });

// ── Search context ──────────────────────────────────────────────────────────

export const setSearchContext = async (path: string): Promise<void> =>
  await transport('set_search_context', { path });

export const addWhitelistedPath = async (path: string): Promise<void> =>
  await transport('add_whitelisted_path', { path });

// ── AI-powered search ───────────────────────────────────────────────────────

export const aiSearch = async (
  query: string,
  provider: string,
  apiKey?: string,
  model?: string,
  limit?: number,
): Promise<AISearchResult> =>
  await transport('ai_search', {
    query,
    provider,
    apiKey: apiKey || null,
    model: model || null,
    limit: limit || null,
  });

// ── Structured / enhanced search ────────────────────────────────────────────

export const parseSearchQuery = async (
  query: string,
  language?: string,
): Promise<StructuredQuery> =>
  await transport('parse_search_query', { query, language: language || null });

export const enhancedSearch = async (
  query: string,
  language?: string,
  limit?: number,
): Promise<EnhancedSearchResult> =>
  await transport('enhanced_search', {
    query,
    language: language || null,
    limit: limit || null,
  });

// ── AI Index ────────────────────────────────────────────────────────────────

export const getAIIndexStatus = async (): Promise<AIIndexStatus> =>
  await transport('get_ai_index_status');

export const triggerAIIndexing = async (
  paths: string[],
  provider?: 'ollama' | 'claude' | 'openai',
  apiKey?: string,
  model?: string,
): Promise<void> =>
  await transport('trigger_ai_indexing', {
    paths,
    provider: provider || null,
    apiKey: apiKey || null,
    model: model || null,
  });

export const getAIIndexEntry = async (path: string): Promise<AIIndexEntry | null> =>
  await transport('get_ai_index_entry', { path });

// ── Semantic search ─────────────────────────────────────────────────────────

export const semanticSearch = async (query: string, limit?: number): Promise<SearchResult[]> =>
  await transport('semantic_search', { query, limit: limit || null });

export const findSimilarFiles = async (filePath: string, limit?: number): Promise<SearchResult[]> =>
  await transport('find_similar_files', { filePath, limit: limit || null });
