import { transport } from '../transport';
import type {
  SearchResult,
  TokenizerSettings,
  TokenIndex,
  FileToken,
  StructuredQuery,
  EnhancedSearchResult,
  AISearchResult,
} from '../types';

export const findFiles = async (pattern: string, searchPath: string): Promise<string[]> => {
  return await transport('find_files', { pattern, searchPath });
};

export const searchInFiles = async (
  pattern: string,
  searchPath: string,
): Promise<{ file: string; line: number; content: string }[]> => {
  return await transport('search_in_files', { pattern, searchPath });
};

export const parseSearchQuery = async (
  query: string,
  language?: string,
): Promise<StructuredQuery> => {
  return await transport('parse_search_query', { query, language: language || null });
};

export const enhancedSearch = async (
  query: string,
  language?: string,
  limit?: number,
): Promise<EnhancedSearchResult> => {
  return await transport('enhanced_search', {
    query,
    language: language || null,
    limit: limit || null,
  });
};

export const aiSearch = async (
  query: string,
  provider: string,
  apiKey?: string,
  model?: string,
  limit?: number,
): Promise<AISearchResult> => {
  return await transport('ai_search', {
    query,
    provider,
    apiKey: apiKey || null,
    model: model || null,
    limit: limit || null,
  });
};

export const semanticSearch = async (query: string, limit?: number): Promise<SearchResult[]> => {
  return await transport('semantic_search', { query, limit: limit || null });
};

export const findSimilarFiles = async (
  filePath: string,
  limit?: number,
): Promise<SearchResult[]> => {
  return await transport('find_similar_files', { filePath, limit: limit || null });
};

export const setTokenizerSettings = async (settings: TokenizerSettings): Promise<void> => {
  return await transport('set_tokenizer_settings', { settings });
};

export const getTokenizerSettings = async (): Promise<TokenizerSettings> => {
  return await transport('get_tokenizer_settings');
};

export const rebuildTokenIndex = async (): Promise<void> => {
  return await transport('rebuild_token_index');
};

export const searchTokens = async (query: string, limit?: number): Promise<SearchResult[]> => {
  return await transport('search_tokens', { query, limit: limit || null });
};

export const naturalLanguageSearch = async (
  query: string,
  language?: string,
  limit?: number,
): Promise<SearchResult[]> => {
  return await transport('natural_language_search', { query, language, limit });
};

export const getTokenizerStats = async (): Promise<TokenIndex | null> => {
  return await transport('get_tokenizer_stats');
};

export const isTokenizerIndexing = async (): Promise<boolean> => {
  return await transport('is_tokenizer_indexing');
};

export const getFileTokens = async (filePath: string): Promise<FileToken | null> => {
  return await transport('get_file_tokens', { filePath });
};

export const addPathToTokenizer = async (path: string): Promise<void> => {
  return await transport('add_path_to_tokenizer', { path });
};

export const getFileRecommendations = async (
  filePath: string,
  limit?: number,
): Promise<SearchResult[]> => {
  return await transport('get_file_recommendations', { filePath, limit });
};

export const indexDirectory = async (path: string, maxDepth?: number): Promise<void> => {
  return await transport('index_directory', { path, maxDepth: maxDepth || null });
};

export const setSearchContext = async (path: string): Promise<void> => {
  return await transport('set_search_context', { path });
};

export const addWhitelistedPath = async (path: string): Promise<void> => {
  return await transport('add_whitelisted_path', { path });
};

export const startSearchWatcher = async (path: string): Promise<void> => {
  return await transport('start_search_watcher', { path });
};

export const stopSearchWatcher = async (path?: string): Promise<void> => {
  return await transport('stop_search_watcher', { path: path || null });
};

export const getSearchWatcherStatus = async (): Promise<{
  running: boolean;
  watched_paths: string[];
}> => {
  return await transport('get_search_watcher_status');
};
