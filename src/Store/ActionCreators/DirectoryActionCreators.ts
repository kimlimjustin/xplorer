import { UnlistenFn } from "@tauri-apps/api/event";

import {
  IDirectoryMeta,
  CancelDirectorySearchFailure, CancelDirectorySearchRequest, CancelDirectorySearchSuccess,
  FetchDirectorySizeFailure, FetchDirectorySizeRequest, FetchDirectorySizeSuccess,
  FetchFilesFailure, FetchFilesRequest, FetchFilesSuccess,
  FetchIsDirectoryFailure, FetchIsDirectoryRequest, FetchIsDirectorySuccess,
  FetchFileExistsFailure, FetchFileExistsRequest, FetchFileExistsSuccess,
  InitDirectorySearchFailure, InitDirectorySearchRequest, InitDirectorySearchSuccess,
  ListenDirectoryFailure, ListenDirectoryRequest, ListenDirectorySuccess,
  MakeDirectoryFailure, MakeDirectoryRequest, MakeDirectorySuccess,
  UnlistenDirectoryFailure, UnlistenDirectoryRequest, UnlistenDirectorySuccess
} from "../../Typings/Store/directory";

import FileMetaData from "../../Typings/fileMetaData";

export const fetchFilesRequest = (dirName: string): FetchFilesRequest => ({
  type: 'FETCH_FILES',
  status: 'REQUEST',
  dirName
});

export const fetchFilesSuccess = (meta: IDirectoryMeta): FetchFilesSuccess => ({
  type: 'FETCH_FILES',
  status: 'SUCCESS',
  meta
});

export const fetchFilesFailure = (message: string): FetchFilesFailure => ({
  type: 'FETCH_FILES',
  status: 'FAILURE',
  message
});

export const fetchIsDirectoryRequest = (path: string): FetchIsDirectoryRequest => ({
  type: 'FETCH_IS_DIR',
  status: 'REQUEST',
  path
});

export const fetchIsDirectorySuccess = (isDir: boolean): FetchIsDirectorySuccess => ({
  type: 'FETCH_IS_DIR',
  status: 'SUCCESS',
  isDir
});

export const fetchIsDirectoryFailure = (message: string): FetchIsDirectoryFailure => ({
  type: 'FETCH_IS_DIR',
  status: 'FAILURE',
  message
});

export const fetchFileExistsRequest = (filePath: string): FetchFileExistsRequest => ({
  type: 'FETCH_FILE_EXISTS',
  status: 'REQUEST',
  filePath
});

export const fetchFileExistsSuccess = (exists: boolean): FetchFileExistsSuccess => ({
  type: 'FETCH_FILE_EXISTS',
  status: 'SUCCESS',
  exists
});

export const fetchFileExistsFailure = (message: string): FetchFileExistsFailure => ({
  type: 'FETCH_FILE_EXISTS',
  status: 'FAILURE',
  message
});

export const makeDirectoryRequest = (dirPath: string): MakeDirectoryRequest => ({
  type: 'MAKE_DIRECTORY',
  status: 'REQUEST',
  dirPath
});

export const makeDirectorySuccess = (): MakeDirectorySuccess => ({
  type: 'MAKE_DIRECTORY',
  status: 'SUCCESS'
});

export const makeDirectoryFailure = (message: string): MakeDirectoryFailure => ({
  type: 'MAKE_DIRECTORY',
  status: 'FAILURE',
  message
});

export const listenDirectoryRequest = (dirPath: string): ListenDirectoryRequest => ({
  type: 'LISTEN_DIRECTORY',
  status: 'REQUEST',
  dirPath
});

export const listenDirectorySuccess = (listener: UnlistenFn): ListenDirectorySuccess => ({
  type: 'LISTEN_DIRECTORY',
  status: 'SUCCESS',
  listener
});

export const listenDirectoryFailure = (message: string): ListenDirectoryFailure => ({
  type: 'LISTEN_DIRECTORY',
  status: 'FAILURE',
  message
});

export const unlistenDirectoryRequest = (listener: UnlistenFn): UnlistenDirectoryRequest => ({
  type: 'UNLISTEN_DIRECTORY',
  status: 'REQUEST',
  listener
});

export const unlistenDirectorySuccess = (): UnlistenDirectorySuccess => ({
  type: 'UNLISTEN_DIRECTORY',
  status: 'SUCCESS'
});

export const unlistenDirectoryFailure = (message: string): UnlistenDirectoryFailure => ({
  type: 'UNLISTEN_DIRECTORY',
  status: 'FAILURE',
  message
});

export const fetchDirectorySizeRequest = (dirName: string): FetchDirectorySizeRequest => ({
  type: 'FETCH_DIRECTORY_SIZE',
  status: 'REQUEST',
  dirName
});

export const fetchDirectorySizeSuccess = (dirSize: number): FetchDirectorySizeSuccess => ({
  type: 'FETCH_DIRECTORY_SIZE',
  status: 'SUCCESS',
  dirSize
});

export const fetchDirectorySizeFailure = (message: string): FetchDirectorySizeFailure => ({
  type: 'FETCH_DIRECTORY_SIZE',
  status: 'FAILURE',
  message
});

export const initDirectorySearchRequest = (dirName: string, pattern: string, callback: (partialFound: FileMetaData[]) => void): InitDirectorySearchRequest => ({
  type: 'INIT_DIRECTORY_SEARCH',
  status: 'REQUEST',
  dirName,
  pattern,
  callback
});

export const initDirectorySearchSuccess = (results: FileMetaData[]): InitDirectorySearchSuccess => ({
  type: 'INIT_DIRECTORY_SEARCH',
  status: 'SUCCESS',
  results
});

export const initDirectorySearchFailure = (message: string): InitDirectorySearchFailure => ({
  type: 'INIT_DIRECTORY_SEARCH',
  status: 'FAILURE',
  message
});

export const cancelDirectorySearchRequest = (listener?: UnlistenFn): CancelDirectorySearchRequest => ({
  type: 'CANCEL_DIRECTORY_SEARCH',
  status: 'REQUEST',
  listener
});

export const cancelDirectorySearchSuccess = (): CancelDirectorySearchSuccess => ({
  type: 'CANCEL_DIRECTORY_SEARCH',
  status: 'SUCCESS'
});

export const cancelDirectorySearchFailure = (message: string): CancelDirectorySearchFailure => ({
  type: 'CANCEL_DIRECTORY_SEARCH',
  status: 'FAILURE',
  message
});
