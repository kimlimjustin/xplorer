import { AppActions, AppActionTypes } from "./app";
import { CliActions, CliActionTypes } from "./cli";
import { DirectoryActions, DirectoryActionTypes } from "./directory";
import { DriveActions, DriveActionTypes } from "./drive";
import { FavoritesActions, FavoritesActionTypes } from "./favorites";
import { FileActions, FileActionTypes } from "./files";
import { LocalesActions, LocalesActionTypes } from "./locales";
import { PlatformActions, PlatformActionTypes } from "./platform";
import { StorageActions, StorageActionTypes } from "./storage";
import { WindowActions, WindowActionTypes } from "./window";

export type Actions = AppActions | CliActions | DirectoryActions | DriveActions | FavoritesActions
  | FileActions | LocalesActions | PlatformActions | StorageActions | WindowActions;

export type ActionTypes = AppActionTypes | CliActionTypes | DirectoryActionTypes | DriveActionTypes | FavoritesActionTypes
  | FileActionTypes | LocalesActionTypes | PlatformActionTypes | StorageActionTypes | WindowActionTypes;
