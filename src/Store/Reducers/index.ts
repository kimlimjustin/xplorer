import { combineReducers } from 'redux';
import { Actions } from '../../Typings/Store/store';

import { IAppReducerState } from '../../Typings/Store/app';
import { ICliReducerState } from '../../Typings/Store/cli';
import { IDirectoryReducerState } from '../../Typings/Store/directory';
import { IDriveReducerState } from '../../Typings/Store/drive';
import { IFavoritesReducerState } from '../../Typings/Store/favorites';
import { IFilesReducerState } from '../../Typings/Store/files';
import { ILocalesReducerState } from '../../Typings/Store/locales';
import { IPlatformReducerState } from '../../Typings/Store/platform';
import { IRequestReducerState } from '../../Typings/Store/request'
import { IStorageReducerState } from '../../Typings/Store/storage';
import { IWindowReducerState } from '../../Typings/Store/window';

import AppReducer from "./AppReducer";
import CliReducer from "./CliReducer";
import DirectoryReducer from "./DirectoryReducer";
import DriveReducer from "./DriveReducer";
import FavoritesReducer from "./FavoritesReducer";
import FilesReducer from "./FilesReducer";
import LocalesReducer from "./LocalesReducer";
import PlatformReducer from "./PlatformReducer";
import RequestReducer from "./RequestReducer";
import StorageReducer from "./StorageReducer";
import WindowReducer from "./WindowReducer";

export interface IAppState {
  app: IAppReducerState,
  cli: ICliReducerState,
  directory: IDirectoryReducerState,
  drive: IDriveReducerState,
  favorites: IFavoritesReducerState,
  files: IFilesReducerState,
  locales: ILocalesReducerState,
  platform: IPlatformReducerState,
  requests: IRequestReducerState,
  storage: IStorageReducerState,
  window: IWindowReducerState
}

const rootReducer = combineReducers<IAppState, Actions>({
  app: AppReducer,
  cli: CliReducer,
  directory: DirectoryReducer,
  drive: DriveReducer,
  favorites: FavoritesReducer,
  files: FilesReducer,
  locales: LocalesReducer,
  platform: PlatformReducer,
  requests: RequestReducer,
  storage: StorageReducer,
  window: WindowReducer
});

export default rootReducer;
