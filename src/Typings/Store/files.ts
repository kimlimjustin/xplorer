import { AppActionBase } from "./actions";
import FileMetaData from "../fileMetaData";

export interface TrashData {
  files: FileMetaData[],
}

export interface FileTrashMeta {
  status: boolean,
  message: string,
  request_confirmation: boolean
}

export interface IFile extends FileMetaData {
  content?: string,
  icon?: string
}

export interface IFilesReducerState {
  buffers: Record<string, Buffer>,
  files: Record<string, IFile>,
  skippedFiles: string[],
  jsonFiles: Record<string, JSON>,
  trashedFiles: Record<string, FileMetaData>,
  filePreview: string
}

export const READ_FILE = 'READ_FILE';
export const READ_BUFFER = 'READ_BUFFER';
export const OPEN_FILE = 'OPEN_FILE';
export const READ_ASSET = 'READ_ASSET';
export const READ_JSON_FILE = 'READ_JSON_FILE';
export const CREATE_FILE = 'CREATE_FILE';
export const FETCH_FILE_PROPERTIES = 'FETCH_FILE_PROPERTIES';
export const IS_DIRECTORY = 'IS_DIRECTORY';
export const EXTRACT_ICON = 'EXTRACT_ICON';
export const CALCULATE_FILE_SIZE = 'CALCULATE_FILE_SIZE';
export const RENAME_FILE = 'RENAME_FILE';
export const COPY_FILE = 'COPY_FILE';
export const CUT_FILE = 'CUT_FILE';
export const REMOVE_FILE = 'REMOVE_FILE';
export const REVEAL_FILE = 'REVEAL_FILE';
export const GET_TRASHED_FILES = 'GET_TRASHED_FILES';
export const DELETE_FILES = 'DELETE_FILES';
export const RESTORE_FILE = 'RESTORE_FILE';
export const RESTORE_FILES = 'RESTORE_FILES';
export const PURGE_FILES = 'PURGE_FILES';

export const OPEN_FILE_PREVIEW = 'OPEN_FILE_PREVIEW'; // * Internal
export const CLOSE_FILE_PREVIEW = 'CLOSE_FILE_PREVIEW'; // * Internal

export type ReadFileRequest = AppActionBase<typeof READ_FILE, 'REQUEST'> & { fileName: string };
export type ReadFileSuccess = AppActionBase<typeof READ_FILE, 'SUCCESS'> & { fileName: string, content: string };
export type ReadFileFailure = AppActionBase<typeof READ_FILE, 'FAILURE'> & { message: string };

export type ReadBufferRequest = AppActionBase<typeof READ_BUFFER, 'REQUEST'> & { fileName: string };
export type ReadBufferSuccess = AppActionBase<typeof READ_BUFFER, 'SUCCESS'> & { fileName: string, content: Buffer };
export type ReadBufferFailure = AppActionBase<typeof READ_BUFFER, 'FAILURE'> & { message: string };

export type OpenFileRequest = AppActionBase<typeof OPEN_FILE, 'REQUEST'> & { fileName: string };
export type OpenFileSuccess = AppActionBase<typeof OPEN_FILE, 'SUCCESS'> & {};
export type OpenFileFailure = AppActionBase<typeof OPEN_FILE, 'FAILURE'> & { message: string };

export type ReadAssetRequest = AppActionBase<typeof READ_ASSET, 'REQUEST'> & { fileName: string };
export type ReadAssetSuccess = AppActionBase<typeof READ_ASSET, 'SUCCESS'> & { fileName: string, content: string };
export type ReadAssetFailure = AppActionBase<typeof READ_ASSET, 'FAILURE'> & { message: string };

export type ReadJsonFileRequest = AppActionBase<typeof READ_JSON_FILE, 'REQUEST'> & { fileName: string };
export type ReadJsonFileSuccess = AppActionBase<typeof READ_JSON_FILE, 'SUCCESS'> & { fileName: string, content: JSON };
export type ReadJsonFileFailure = AppActionBase<typeof READ_JSON_FILE, 'FAILURE'> & { message: string };

export type CreateFileRequest = AppActionBase<typeof CREATE_FILE, 'REQUEST'> & { fileName: string };
export type CreateFileSuccess = AppActionBase<typeof CREATE_FILE, 'SUCCESS'> & {};
export type CreateFileFailure = AppActionBase<typeof CREATE_FILE, 'FAILURE'> & { message: string };

export type FetchFilePropertiesRequest = AppActionBase<typeof FETCH_FILE_PROPERTIES, 'REQUEST'> & { fileName: string };
export type FetchFilePropertiesSuccess = AppActionBase<typeof FETCH_FILE_PROPERTIES, 'SUCCESS'> & { fileName: string, metadata: FileMetaData };
export type FetchFilePropertiesFailure = AppActionBase<typeof FETCH_FILE_PROPERTIES, 'FAILURE'> & { message: string };

export type IsDirectoryRequest = AppActionBase<typeof IS_DIRECTORY, 'REQUEST'> & { fileName: string };
export type IsDirectorySuccess = AppActionBase<typeof IS_DIRECTORY, 'SUCCESS'> & { fileName: string, isDirectory: boolean };
export type IsDirectoryFailure = AppActionBase<typeof IS_DIRECTORY, 'FAILURE'> & { message: string };

export type ExtractIconRequest = AppActionBase<typeof EXTRACT_ICON, 'REQUEST'> & { fileName: string };
export type ExtractIconSuccess = AppActionBase<typeof EXTRACT_ICON, 'SUCCESS'> & { fileName: string, iconPath: string };
export type ExtractIconFailure = AppActionBase<typeof EXTRACT_ICON, 'FAILURE'> & { message: string };

export type CalculateFileSizeRequest = AppActionBase<typeof CALCULATE_FILE_SIZE, 'REQUEST'> & { fileName: string };
export type CalculateFileSizeSuccess = AppActionBase<typeof CALCULATE_FILE_SIZE, 'SUCCESS'> & { fileName: string, size: number };
export type CalculateFileSizeFailure = AppActionBase<typeof CALCULATE_FILE_SIZE, 'FAILURE'> & { message: string };

export type RenameFileRequest = AppActionBase<typeof RENAME_FILE, 'REQUEST'> & { fileName: string, dest: string };
export type RenameFileSuccess = AppActionBase<typeof RENAME_FILE, 'SUCCESS'> & { fileName: string, dest: string };
export type RenameFileFailure = AppActionBase<typeof RENAME_FILE, 'FAILURE'> & { message: string };

export type CopyFileRequest = AppActionBase<typeof COPY_FILE, 'REQUEST'> & { fileName: string, dest: string };
export type CopyFileSuccess = AppActionBase<typeof COPY_FILE, 'SUCCESS'> & {};
export type CopyFileFailure = AppActionBase<typeof COPY_FILE, 'FAILURE'> & { message: string };

export type CutFileRequest = AppActionBase<typeof CUT_FILE, 'REQUEST'> & { fileName: string, dest: string };
export type CutFileSuccess = AppActionBase<typeof CUT_FILE, 'SUCCESS'> & {};
export type CutFileFailure = AppActionBase<typeof CUT_FILE, 'FAILURE'> & { message: string };

export type RemoveFileRequest = AppActionBase<typeof REMOVE_FILE, 'REQUEST'> & { fileName: string };
export type RemoveFileSuccess = AppActionBase<typeof REMOVE_FILE, 'SUCCESS'> & { fileName: string };
export type RemoveFileFailure = AppActionBase<typeof REMOVE_FILE, 'FAILURE'> & { message: string };

export type RevealFileRequest = AppActionBase<typeof REVEAL_FILE, 'REQUEST'> & { fileName: string, app: string };
export type RevealFileSuccess = AppActionBase<typeof REVEAL_FILE, 'SUCCESS'> & {};
export type RevealFileFailure = AppActionBase<typeof REVEAL_FILE, 'FAILURE'> & { message: string };

export type GetTrashedFilesRequest = AppActionBase<typeof GET_TRASHED_FILES, 'REQUEST'> & {};
export type GetTrashedFilesSuccess = AppActionBase<typeof GET_TRASHED_FILES, 'SUCCESS'> & { metadata: TrashData };
export type GetTrashedFilesFailure = AppActionBase<typeof GET_TRASHED_FILES, 'FAILURE'> & { message: string };

export type DeleteFilesRequest = AppActionBase<typeof DELETE_FILES, 'REQUEST'> & { paths: string[] };
export type DeleteFilesSuccess = AppActionBase<typeof DELETE_FILES, 'SUCCESS'> & { paths: string[] };
export type DeleteFilesFailure = AppActionBase<typeof DELETE_FILES, 'FAILURE'> & { message: string };

export type RestoreFileRequest = AppActionBase<typeof RESTORE_FILE, 'REQUEST'> & { originalParent: string, basename: string };
export type RestoreFileSuccess = AppActionBase<typeof RESTORE_FILE, 'SUCCESS'> & {};
export type RestoreFileFailure = AppActionBase<typeof RESTORE_FILE, 'FAILURE'> & { message: string };

export type RestoreFilesRequest = AppActionBase<typeof RESTORE_FILES, 'REQUEST'> & { paths: string[], force: boolean };
export type RestoreFilesSuccess = AppActionBase<typeof RESTORE_FILES, 'SUCCESS'> & { metadata: FileTrashMeta };
export type RestoreFilesFailure = AppActionBase<typeof RESTORE_FILES, 'FAILURE'> & { message: string };

export type PurgeFilesRequest = AppActionBase<typeof PURGE_FILES, 'REQUEST'> & { paths: string[] };
export type PurgeFilesSuccess = AppActionBase<typeof PURGE_FILES, 'SUCCESS'> & { paths: string[] };
export type PurgeFilesFailure = AppActionBase<typeof PURGE_FILES, 'FAILURE'> & { message: string };

export type OpenFilePreviewSuccess = AppActionBase<typeof OPEN_FILE_PREVIEW, 'SUCCESS'> & { path: string };
export type CloseFilePreviewSuccess = AppActionBase<typeof CLOSE_FILE_PREVIEW, 'SUCCESS'>;

export type FileActions = ReadFileRequest | ReadFileSuccess | ReadFileFailure
  | ReadBufferRequest | ReadBufferSuccess | ReadBufferFailure
  | OpenFileRequest | OpenFileSuccess | OpenFileFailure
  | ReadAssetRequest | ReadAssetSuccess | ReadAssetFailure
  | ReadJsonFileRequest | ReadJsonFileSuccess | ReadJsonFileFailure
  | CreateFileRequest | CreateFileSuccess | CreateFileFailure
  | FetchFilePropertiesRequest | FetchFilePropertiesSuccess | FetchFilePropertiesFailure
  | IsDirectoryRequest | IsDirectorySuccess | IsDirectoryFailure
  | ExtractIconRequest | ExtractIconSuccess | ExtractIconFailure
  | CalculateFileSizeRequest | CalculateFileSizeSuccess | CalculateFileSizeFailure
  | RenameFileRequest | RenameFileSuccess | RenameFileFailure
  | CopyFileRequest | CopyFileSuccess | CopyFileFailure
  | CutFileRequest | CutFileSuccess | CutFileFailure
  | RemoveFileRequest | RemoveFileSuccess | RemoveFileFailure
  | RevealFileRequest | RevealFileSuccess | RevealFileFailure
  | GetTrashedFilesRequest | GetTrashedFilesSuccess | GetTrashedFilesFailure
  | DeleteFilesRequest | DeleteFilesSuccess | DeleteFilesFailure
  | RestoreFileRequest | RestoreFileSuccess | RestoreFileFailure
  | RestoreFilesRequest | RestoreFilesSuccess | RestoreFilesFailure
  | PurgeFilesRequest | PurgeFilesSuccess | PurgeFilesFailure
  | OpenFilePreviewSuccess | CloseFilePreviewSuccess;

export type FileActionTypes = typeof READ_FILE | typeof READ_BUFFER | typeof OPEN_FILE | typeof READ_ASSET
  | typeof READ_JSON_FILE | typeof CREATE_FILE | typeof FETCH_FILE_PROPERTIES | typeof IS_DIRECTORY | typeof EXTRACT_ICON
  | typeof CALCULATE_FILE_SIZE | typeof RENAME_FILE | typeof COPY_FILE | typeof CUT_FILE
  | typeof REMOVE_FILE | typeof REVEAL_FILE | typeof GET_TRASHED_FILES | typeof DELETE_FILES
  | typeof RESTORE_FILE | typeof RESTORE_FILES | typeof PURGE_FILES | typeof OPEN_FILE_PREVIEW | typeof CLOSE_FILE_PREVIEW;
