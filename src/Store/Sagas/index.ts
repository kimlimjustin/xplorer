import { all, fork } from "redux-saga/effects";

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
import windowSaga from './WindowSaga';

function* rootSaga() {
  yield all([
    fork(appSaga),
    fork(cliSaga),
    fork(clipboardSaga),
    fork(directorySaga),
    fork(drivesSaga),
    fork(favoritesSaga),
    fork(filesSaga),
    fork(localeSaga),
    fork(platformSaga),
    fork(storageSaga),
    fork(windowSaga)
  ]);
}

export default rootSaga;
