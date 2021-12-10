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
  UnlistenDirectoryFailure, UnlistenDirectoryRequest, UnlistenDirectorySuccess,
  DirectorySearchPartialResultSuccess, DirectorySearchPartialResultFailure
} from "../../Typings/Store/directory";

import FileMetaData from "../../Typings/fileMetaData";

export const fetchFilesRequest = (dirName: string): FetchFilesRequest => ({
  type: 'FETCH_FILES',
  status: 'REQUEST',
  dirName
});

export const fetchFilesSuccess = (dirName: string, meta: IDirectoryMeta): FetchFilesSuccess => ({
  type: 'FETCH_FILES',
  status: 'SUCCESS',
  dirName,
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

export const listenDirectoryRequest = (dirName: string, callback: () => void = () => undefined): ListenDirectoryRequest => ({
  type: 'LISTEN_DIRECTORY',
  status: 'REQUEST',
  dirName,
  callback
});

export const listenDirectorySuccess = (dirName: string, listener: UnlistenFn): ListenDirectorySuccess => ({
  type: 'LISTEN_DIRECTORY',
  status: 'SUCCESS',
  dirName,
  listener
});

export const listenDirectoryFailure = (message: string): ListenDirectoryFailure => ({
  type: 'LISTEN_DIRECTORY',
  status: 'FAILURE',
  message
});

export const unlistenDirectoryRequest = (dirName: string): UnlistenDirectoryRequest => ({
  type: 'UNLISTEN_DIRECTORY',
  status: 'REQUEST',
  dirName
});

export const unlistenDirectorySuccess = (dirName: string): UnlistenDirectorySuccess => ({
  type: 'UNLISTEN_DIRECTORY',
  status: 'SUCCESS',
  dirName
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

export const fetchDirectorySizeSuccess = (dirName: string, dirSize: number): FetchDirectorySizeSuccess => ({
  type: 'FETCH_DIRECTORY_SIZE',
  status: 'SUCCESS',
  dirName,
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

export const directorySearchSuccess = (results: FileMetaData[]): InitDirectorySearchSuccess => ({
  type: 'INIT_DIRECTORY_SEARCH',
  status: 'SUCCESS',
  results
});

export const directorySearchFailure = (message: string): InitDirectorySearchFailure => ({
  type: 'INIT_DIRECTORY_SEARCH',
  status: 'FAILURE',
  message
});

export const directorySearchPartialResultSuccess = (result: FileMetaData[]): DirectorySearchPartialResultSuccess => ({
  type: 'DIRECTORY_SEARCH_PARTIAL_RESULT',
  status: 'SUCCESS',
  result
});

export const directorySearchPartialResultFailure = (message: string): DirectorySearchPartialResultFailure => ({
  type: 'DIRECTORY_SEARCH_PARTIAL_RESULT',
  status: 'FAILURE',
  message
});

export const cancelDirectorySearchRequest = (dirName: string, listener: UnlistenFn): CancelDirectorySearchRequest => ({
  type: 'CANCEL_DIRECTORY_SEARCH',
  status: 'REQUEST',
  dirName,
  listener
});

export const cancelDirectorySearchSuccess = (dirName: string): CancelDirectorySearchSuccess => ({
  type: 'CANCEL_DIRECTORY_SEARCH',
  status: 'SUCCESS',
  dirName
});

export const cancelDirectorySearchFailure = (message: string): CancelDirectorySearchFailure => ({
  type: 'CANCEL_DIRECTORY_SEARCH',
  status: 'FAILURE',
  message
});
