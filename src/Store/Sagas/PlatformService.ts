import { all, call, takeLatest } from "redux-saga/effects";

import { getOSFailure, getOSSuccess } from "../ActionCreators/PlatformActionCreators";
import {} from "../../Typings/Store/platform";

import { selectStatus, typedPut as put } from "./helpers";
import * as PlatformService from "../../Services/PlatformService";

function* getOSWorker() {
    try {
        const os: string = yield call(PlatformService.getOS);
        yield put(getOSSuccess(os));
    } catch (error) {
        yield put(getOSFailure(error.message));
    }
}

function* platformSaga() {
    yield all([takeLatest(selectStatus("GET_OS"), getOSWorker)]);
}

export default platformSaga;
