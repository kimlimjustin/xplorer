import { all, call, takeLatest } from "redux-saga/effects";

import { fetchDrivesFailure, fetchDrivesSuccess } from "../ActionCreators/DriveActionCreators";

import { selectStatus, typedPut as put } from "./helpers";
import * as DrivesService from "../../Services/DrivesService";
import { IDrive } from "../../Typings/Store/drive";

function* fetchDrivesWorker(/* action: FetchDrivesRequest */) {
  try {
    const drives: IDrive[] = yield call(DrivesService.fetchDrives);
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
