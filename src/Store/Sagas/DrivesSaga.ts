import { all, call, takeLatest } from "redux-saga/effects";

import { fetchDrivesFailure, fetchDrivesSuccess } from "../ActionCreators/DriveActionCreators";
import { getOSRequest } from "../ActionCreators/PlatformActionCreators";

import { selectStatus, typedPut as put, typedSelect as select } from "./helpers";
import * as DrivesService from "../../Services/DrivesService";
import { IDrive } from "../../Typings/Store/drive";

function* fetchDrivesWorker(/* action: FetchDrivesRequest */) {
  try {
    const os: string = yield select(state => state.platform.os);

    if (!os) { yield put(getOSRequest()); }

    // TODO WAIT FOR OS RESOLVE

    const drives: IDrive[] = yield call(DrivesService.fetchDrives, os);
    yield put(fetchDrivesSuccess(drives));
  } catch (error) {
    yield put(fetchDrivesFailure(error.message));
  }
}

function* drivesSaga() {
  yield all([
    takeLatest(selectStatus('FETCH_DRIVES'), fetchDrivesWorker)
  ]);
}

export default drivesSaga;
