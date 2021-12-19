import { all, spawn } from "redux-saga/effects";

import appSaga from './AppSaga';
import cliSaga from './CliSaga';
import clipboardSaga from './ClipboardSaga';
import directorySaga from './DirectorySaga';
import drivesSaga from './DrivesSaga';
import favoritesSaga from './FavoritesSaga';
import filesSaga from './FilesSaga';
import localeSaga from './LocaleSaga';
import platformSaga from './PlatformService';
import storageSaga from './StorageSaga';
import tabSaga from './TabSaga';
import windowSaga from './WindowSaga';

function* rootSaga() {
  yield all([
    spawn(appSaga),
    spawn(cliSaga),
    spawn(clipboardSaga),
    spawn(directorySaga),
    spawn(drivesSaga),
    spawn(favoritesSaga),
    spawn(filesSaga),
    spawn(localeSaga),
    spawn(platformSaga),
    spawn(storageSaga),
    spawn(tabSaga),
    spawn(windowSaga)
  ]);
}

export default rootSaga;
