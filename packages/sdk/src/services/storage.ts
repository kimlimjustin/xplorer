import { transport } from '../transport';
import type {
  BookmarkEntry,
  FileTag,
  FileNote,
  NoteSearchResult,
  FileAnnotation,
  TagCategory,
  CustomMetadataField,
  RecentFile,
} from '../types';

// Bookmark operations

export const getBookmarks = async (): Promise<BookmarkEntry[]> => {
  return await transport('get_bookmarks');
};

export const addBookmark = async (path: string, name: string): Promise<BookmarkEntry> => {
  return await transport('add_bookmark', { path, name });
};

export const removeBookmark = async (path: string): Promise<void> => {
  return await transport('remove_bookmark', { path });
};

export const updateBookmarkName = async (path: string, name: string): Promise<void> => {
  return await transport('update_bookmark_name', { path, name });
};

// File Tags operations

export const getFileTags = async (path: string): Promise<FileTag[]> => {
  return await transport('get_file_tags', { path });
};

export const setFileTags = async (path: string, tags: FileTag[]): Promise<void> => {
  return await transport('set_file_tags', { path, tags });
};

export const getAllFileTags = async (): Promise<FileTag[]> => {
  return await transport('get_all_file_tags');
};

export const getFileTagsBatch = async (paths: string[]): Promise<Record<string, FileTag[]>> => {
  return await transport('get_file_tags_batch', { paths });
};

export const removeAllTagsFromFile = async (path: string): Promise<void> => {
  return await transport('remove_all_tags_from_file', { path });
};

export const removeTagGlobally = async (tagName: string): Promise<void> => {
  return await transport('remove_tag_globally', { tagName });
};

// File Notes operations

export const getFileNotes = async (path: string): Promise<FileNote[]> => {
  return await transport('get_file_notes', { path });
};

export const addFileNote = async (
  path: string,
  title: string,
  content: string,
): Promise<FileNote> => {
  return await transport('add_file_note', { path, title, content });
};

export const updateFileNote = async (
  path: string,
  noteId: string,
  title: string,
  content: string,
): Promise<void> => {
  return await transport('update_file_note', { path, noteId, title, content });
};

export const deleteFileNote = async (path: string, noteId: string): Promise<void> => {
  return await transport('delete_file_note', { path, noteId });
};

export const getAllNotes = async (): Promise<Record<string, FileNote[]>> => {
  return await transport('get_all_notes');
};

export const searchNotes = async (query: string): Promise<NoteSearchResult[]> => {
  return await transport('search_notes', { query });
};

// File Annotations operations

export const getFileAnnotations = async (path: string): Promise<FileAnnotation[]> => {
  return await transport('get_file_annotations', { path });
};

export const addFileAnnotation = async (path: string, text: string): Promise<FileAnnotation> => {
  return await transport('add_file_annotation', { path, text });
};

export const toggleAnnotationResolved = async (
  path: string,
  annotationId: string,
): Promise<void> => {
  return await transport('toggle_annotation_resolved', { path, annotationId });
};

export const deleteFileAnnotation = async (path: string, annotationId: string): Promise<void> => {
  return await transport('delete_file_annotation', { path, annotationId });
};

export const getAllAnnotations = async (): Promise<Record<string, FileAnnotation[]>> => {
  return await transport('get_all_annotations');
};

// Tag Categories operations

export const getTagCategories = async (): Promise<TagCategory[]> => {
  return await transport('get_tag_categories');
};

export const addTagCategory = async (
  name: string,
  color: string,
  parentId?: string,
): Promise<TagCategory> => {
  return await transport('add_tag_category', { name, color, parentId: parentId ?? null });
};

export const updateTagCategory = async (
  id: string,
  name?: string,
  color?: string,
  parentId?: string,
): Promise<void> => {
  return await transport('update_tag_category', {
    id,
    name: name ?? null,
    color: color ?? null,
    parentId: parentId ?? null,
  });
};

export const deleteTagCategory = async (id: string): Promise<void> => {
  return await transport('delete_tag_category', { id });
};

// Custom Metadata operations

export const getFileMetadata = async (path: string): Promise<CustomMetadataField[]> => {
  return await transport('get_file_metadata', { path });
};

export const setFileMetadata = async (
  path: string,
  fields: CustomMetadataField[],
): Promise<void> => {
  return await transport('set_file_metadata', { path, fields });
};

export const getAllMetadataKeys = async (): Promise<string[]> => {
  return await transport('get_all_metadata_keys');
};

// Recent folders / files

export const getRecentFolders = async (): Promise<string[]> => {
  return await transport('get_recent_folders');
};

export const addToRecentFolders = async (path: string): Promise<void> => {
  return await transport('add_to_recent_folders', { path });
};

export const addRecentFile = async (path: string): Promise<void> => {
  return await transport('add_recent_file', { path });
};

export const getRecentFiles = async (limit?: number): Promise<RecentFile[]> => {
  return await transport('get_recent_files', { limit: limit ?? null });
};

export const clearRecentFiles = async (): Promise<void> => {
  return await transport('clear_recent_files');
};

export const removeRecentFile = async (path: string): Promise<void> => {
  return await transport('remove_recent_file', { path });
};

// Extension-scoped storage

export const getExtensionStorage = async (extensionId: string, key: string): Promise<unknown> => {
  return await transport('get_extension_storage', { extensionId, key });
};

export const setExtensionStorage = async (
  extensionId: string,
  key: string,
  value: unknown,
): Promise<void> => {
  return await transport('set_extension_storage', { extensionId, key, value });
};

export const deleteExtensionStorage = async (extensionId: string, key: string): Promise<void> => {
  return await transport('delete_extension_storage', { extensionId, key });
};
