import { all, call, takeLatest, select, take } from "redux-saga/effects";

import { fetchDrivesFailure, fetchDrivesSuccess } from "../ActionCreators/DriveActionCreators";
import { getOSRequest } from "../ActionCreators/PlatformActionCreators";

import { selectStatus, typedPut as put } from "./helpers";
import * as DrivesService from "../../Services/DrivesService";
import { IDrive } from "../../Typings/Store/drive";

function* fetchDrivesWorker(/* action: FetchDrivesRequest */) {
    try {
        let os: string = yield select((state) => state.platform.os);

        if (!os) {
            // Request OS information
            yield put(getOSRequest());

            // Wait for OS to be successfully loaded
            yield take(selectStatus("GET_OS", "SUCCESS"));

            // Get the OS again after it's been loaded
            os = yield select((state) => state.platform.os);
        }

        console.log("OS detected:", os);
        const drives: IDrive[] = yield call(DrivesService.fetchDrives, os);
        yield put(fetchDrivesSuccess(drives));
    } catch (error) {
        yield put(fetchDrivesFailure(error.message));
    }
}

function* drivesSaga() {
    yield all([takeLatest(selectStatus("FETCH_DRIVES"), fetchDrivesWorker)]);
}

export default drivesSaga;
