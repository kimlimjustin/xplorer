import { combineReducers } from 'redux';
import { Actions } from '../../Typings/Store/store';

import { IAppReducerState } from '../../Typings/Store/app';
import { IClipboardReducerState } from '../../Typings/Store/clipboard';
import { ICliReducerState } from '../../Typings/Store/cli';
import { IConfigReducerState } from '../../Typings/Store/config';
import { IDirectoryReducerState } from '../../Typings/Store/directory';
import { IDriveReducerState } from '../../Typings/Store/drive';
import { IFavoritesReducerState } from '../../Typings/Store/favorites';
import { IFilesReducerState } from '../../Typings/Store/files';
import { ILocalesReducerState } from '../../Typings/Store/locales';
import { IPlatformReducerState } from '../../Typings/Store/platform';
import { IRequestReducerState } from '../../Typings/Store/request'
import { IStorageReducerState } from '../../Typings/Store/storage';
import { ITabReducerState } from '../../Typings/Store/tab';
import { IWindowReducerState } from '../../Typings/Store/window';

import AppReducer from "./AppReducer";
import ClipboardReducer from "./ClipboardReducer";
import CliReducer from "./CliReducer";
import ConfigReducer from "./ConfigReducer";
import DirectoryReducer from "./DirectoryReducer";
import DriveReducer from "./DriveReducer";
import FavoritesReducer from "./FavoritesReducer";
import FilesReducer from "./FilesReducer";
import LocalesReducer from "./LocalesReducer";
import PlatformReducer from "./PlatformReducer";
import RequestReducer from "./RequestReducer";
import StorageReducer from "./StorageReducer";
import TabReducer from "./TabReducer";
import WindowReducer from "./WindowReducer";

export interface IAppState {
  app: IAppReducerState,
  clipboard: IClipboardReducerState,
  cli: ICliReducerState,
  config: IConfigReducerState,
  directory: IDirectoryReducerState,
  drive: IDriveReducerState,
  favorites: IFavoritesReducerState,
  files: IFilesReducerState,
  locales: ILocalesReducerState,
  platform: IPlatformReducerState,
  requests: IRequestReducerState,
  storage: IStorageReducerState,
  tabs: ITabReducerState,
  window: IWindowReducerState
}

const rootReducer = combineReducers<IAppState, Actions>({
  app: AppReducer,
  clipboard: ClipboardReducer,
  cli: CliReducer,
  config: ConfigReducer,
  directory: DirectoryReducer,
  drive: DriveReducer,
  favorites: FavoritesReducer,
  files: FilesReducer,
  locales: LocalesReducer,
  platform: PlatformReducer,
  requests: RequestReducer,
  storage: StorageReducer,
  tabs: TabReducer,
  window: WindowReducer
});

export default rootReducer;
