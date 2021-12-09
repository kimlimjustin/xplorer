import { UnlistenFn } from "@tauri-apps/api/event";
import FileMetaData from "../fileMetaData";
import { AppActionBase } from "./actions";

export interface IDirectoryMeta {
  files: FileMetaData[],
  num_files: number,
  skipped_files: string[]
}

export interface IDirectory {
  files: Set<string>, // References file within file reducer
  numFiles: number,
  skippedFiles: string[]
  dirName: string,
  size: number
}

export interface IDirectoryReducerState {
  directories: Record<string, Partial<IDirectory>>,
  listeners: Record<string, UnlistenFn>,
  searches: Record<string, boolean> //Directory identifier -> search in progress
};

export const FETCH_FILES = 'FETCH_FILES';
export const FETCH_IS_DIR = 'FETCH_IS_DIR';
export const FETCH_FILE_EXISTS = 'FETCH_FILE_EXISTS';
export const MAKE_DIRECTORY = 'MAKE_DIRECTORY';
export const LISTEN_DIRECTORY = 'LISTEN_DIRECTORY';
export const UNLISTEN_DIRECTORY = 'UNLISTEN_DIRECTORY';
export const FETCH_DIRECTORY_SIZE = 'FETCH_DIRECTORY_SIZE';
export const INIT_DIRECTORY_SEARCH = 'INIT_DIRECTORY_SEARCH';
export const CANCEL_DIRECTORY_SEARCH = 'CANCEL_DIRECTORY_SEARCH';

export type FetchFilesRequest = AppActionBase<typeof FETCH_FILES, 'REQUEST'> & { dirName: string };
export type FetchFilesSuccess = AppActionBase<typeof FETCH_FILES, 'SUCCESS'> & { dirName: string, meta: IDirectoryMeta };
export type FetchFilesFailure = AppActionBase<typeof FETCH_FILES, 'FAILURE'> & { message: string };

export type FetchIsDirectoryRequest = AppActionBase<typeof FETCH_IS_DIR, 'REQUEST'> & { path: string };
export type FetchIsDirectorySuccess = AppActionBase<typeof FETCH_IS_DIR, 'SUCCESS'> & { isDir: boolean };
export type FetchIsDirectoryFailure = AppActionBase<typeof FETCH_IS_DIR, 'FAILURE'> & { message: string };

export type FetchFileExistsRequest = AppActionBase<typeof FETCH_FILE_EXISTS, 'REQUEST'> & { filePath: string };
export type FetchFileExistsSuccess = AppActionBase<typeof FETCH_FILE_EXISTS, 'SUCCESS'> & { exists: boolean };
export type FetchFileExistsFailure = AppActionBase<typeof FETCH_FILE_EXISTS, 'FAILURE'> & { message: string };

export type MakeDirectoryRequest = AppActionBase<typeof MAKE_DIRECTORY, 'REQUEST'> & { dirPath: string };
export type MakeDirectorySuccess = AppActionBase<typeof MAKE_DIRECTORY, 'SUCCESS'> & {};
export type MakeDirectoryFailure = AppActionBase<typeof MAKE_DIRECTORY, 'FAILURE'> & { message: string };

export type ListenDirectoryRequest = AppActionBase<typeof LISTEN_DIRECTORY, 'REQUEST'> & { dirName: string };
export type ListenDirectorySuccess = AppActionBase<typeof LISTEN_DIRECTORY, 'SUCCESS'> & { dirName: string, listener: UnlistenFn };
export type ListenDirectoryFailure = AppActionBase<typeof LISTEN_DIRECTORY, 'FAILURE'> & { message: string };

export type UnlistenDirectoryRequest = AppActionBase<typeof UNLISTEN_DIRECTORY, 'REQUEST'> & { dirName: string };
export type UnlistenDirectorySuccess = AppActionBase<typeof UNLISTEN_DIRECTORY, 'SUCCESS'> & { dirName: string };
export type UnlistenDirectoryFailure = AppActionBase<typeof UNLISTEN_DIRECTORY, 'FAILURE'> & { message: string };

export type FetchDirectorySizeRequest = AppActionBase<typeof FETCH_DIRECTORY_SIZE, 'REQUEST'> & { dirName: string };
export type FetchDirectorySizeSuccess = AppActionBase<typeof FETCH_DIRECTORY_SIZE, 'SUCCESS'> & { dirName: string, dirSize: number };
export type FetchDirectorySizeFailure = AppActionBase<typeof FETCH_DIRECTORY_SIZE, 'FAILURE'> & { message: string };

export type InitDirectorySearchRequest = AppActionBase<typeof INIT_DIRECTORY_SEARCH, 'REQUEST'> & { dirName: string, pattern: string, callback: (partialFound: FileMetaData[]) => void };
export type InitDirectorySearchSuccess = AppActionBase<typeof INIT_DIRECTORY_SEARCH, 'SUCCESS'> & { results: FileMetaData[] };
export type InitDirectorySearchFailure = AppActionBase<typeof INIT_DIRECTORY_SEARCH, 'FAILURE'> & { message: string };

export type CancelDirectorySearchRequest = AppActionBase<typeof CANCEL_DIRECTORY_SEARCH, 'REQUEST'> & { listener?: UnlistenFn };
export type CancelDirectorySearchSuccess = AppActionBase<typeof CANCEL_DIRECTORY_SEARCH, 'SUCCESS'> & {};
export type CancelDirectorySearchFailure = AppActionBase<typeof CANCEL_DIRECTORY_SEARCH, 'FAILURE'> & { message: string };

export type DirectoryActions = FetchFilesRequest | FetchFilesSuccess | FetchFilesFailure
  | FetchIsDirectoryRequest | FetchIsDirectorySuccess | FetchIsDirectoryFailure
  | FetchFileExistsRequest | FetchFileExistsSuccess | FetchFileExistsFailure
  | MakeDirectoryRequest | MakeDirectorySuccess | MakeDirectoryFailure
  | ListenDirectoryRequest | ListenDirectorySuccess | ListenDirectoryFailure
  | UnlistenDirectoryRequest | UnlistenDirectorySuccess | UnlistenDirectoryFailure
  | FetchDirectorySizeRequest | FetchDirectorySizeSuccess | FetchDirectorySizeFailure
  | InitDirectorySearchRequest | InitDirectorySearchSuccess | InitDirectorySearchFailure
  | CancelDirectorySearchRequest | CancelDirectorySearchSuccess | CancelDirectorySearchFailure;

export type DirectoryActionTypes = typeof FETCH_FILES | typeof FETCH_IS_DIR | typeof FETCH_FILE_EXISTS | typeof MAKE_DIRECTORY
  | typeof LISTEN_DIRECTORY | typeof UNLISTEN_DIRECTORY | typeof FETCH_DIRECTORY_SIZE | typeof INIT_DIRECTORY_SEARCH
  | typeof CANCEL_DIRECTORY_SEARCH;
