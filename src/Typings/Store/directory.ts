import { UnlistenFn } from "@tauri-apps/api/event";
import FileMetaData from "../fileMetaData";
import { AppActionBase } from "./actions";

export interface IDirectoryMeta {
  files: FileMetaData[],
  num_files: number,
  skipped_files: string[]
}

export interface IDirectoryState {
  dir_name: string,
  parent_dir: string,
  files: Record<string, FileMetaData>
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
export type FetchFilesSuccess = AppActionBase<typeof FETCH_FILES, 'SUCCESS'> & { meta: IDirectoryMeta };
export type FetchFilesFailure = AppActionBase<typeof FETCH_FILES, 'FAILURE'> & { message: string };

export type FetchIsDirectoryRequest = AppActionBase<typeof FETCH_IS_DIR, 'REQUEST'> & { path: string };
export type FetchIsDirectorySuccess = AppActionBase<typeof FETCH_IS_DIR, 'SUCCESS'> & { isDir: boolean };
export type FetchIsDirectoryFailure = AppActionBase<typeof FETCH_IS_DIR, 'FAILURE'> & { message: string };

export type FileExistsRequest = AppActionBase<typeof FETCH_FILE_EXISTS, 'REQUEST'> & { filePath: string };
export type FileExistsSuccess = AppActionBase<typeof FETCH_FILE_EXISTS, 'SUCCESS'> & { exists: boolean };
export type FileExistsFailure = AppActionBase<typeof FETCH_FILE_EXISTS, 'FAILURE'> & { message: string };

export type MakeDirectoryRequest = AppActionBase<typeof MAKE_DIRECTORY, 'REQUEST'> & { dirPath: string };
export type MakeDirectorySuccess = AppActionBase<typeof MAKE_DIRECTORY, 'SUCCESS'> & {};
export type MakeDirectoryFailure = AppActionBase<typeof MAKE_DIRECTORY, 'FAILURE'> & { message: string };

export type ListenDirectoryRequest = AppActionBase<typeof LISTEN_DIRECTORY, 'REQUEST'> & { dirName: string };
export type ListenDirectorySuccess = AppActionBase<typeof LISTEN_DIRECTORY, 'SUCCESS'> & { listener: UnlistenFn };
export type ListenDirectoryFailure = AppActionBase<typeof LISTEN_DIRECTORY, 'FAILURE'> & { message: string };

export type UnlistenDirectoryRequest = AppActionBase<typeof UNLISTEN_DIRECTORY, 'REQUEST'> & { listener: UnlistenFn };
export type UnlistenDirectorySuccess = AppActionBase<typeof UNLISTEN_DIRECTORY, 'SUCCESS'> & {};
export type UnlistenDirectoryFailure = AppActionBase<typeof UNLISTEN_DIRECTORY, 'FAILURE'> & { message: string };

export type FetchFileSizeRequest = AppActionBase<typeof FETCH_DIRECTORY_SIZE, 'REQUEST'> & { dirName: string };
export type FetchFileSizeSuccess = AppActionBase<typeof FETCH_DIRECTORY_SIZE, 'SUCCESS'> & { dirSize: number };
export type FetchFileSizeFailure = AppActionBase<typeof FETCH_DIRECTORY_SIZE, 'FAILURE'> & { message: string };

export type InitDirectorySearchReqeust = AppActionBase<typeof INIT_DIRECTORY_SEARCH, 'REQUEST'> & { dirName: string, pattern: string, callback: (partialFound: FileMetaData[]) => void };
export type InitDirectorySearchSuccess = AppActionBase<typeof INIT_DIRECTORY_SEARCH, 'SUCCESS'> & { results: FileMetaData[] };
export type InitDirectorySearchFailure = AppActionBase<typeof INIT_DIRECTORY_SEARCH, 'FAILURE'> & { message: string };

export type CancelDirectorySearchRequest = AppActionBase<typeof CANCEL_DIRECTORY_SEARCH, 'REQUEST'> & { listener: UnlistenFn };
export type CancelDirectorySearchSuccess = AppActionBase<typeof CANCEL_DIRECTORY_SEARCH, 'SUCCESS'> & {};
export type CancelDirectorySearchFailure = AppActionBase<typeof CANCEL_DIRECTORY_SEARCH, 'FAILURE'> & { message: string };
