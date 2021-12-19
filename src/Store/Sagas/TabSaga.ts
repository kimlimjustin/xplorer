import { all, takeLatest } from "redux-saga/effects";

import { SetActiveTabSuccess } from "../../Typings/Store/tab";

import { selectStatus, typedPut as put } from "./helpers";
import { fetchFilesRequest } from "../ActionCreators/DirectoryActionCreators";

// Requests files when a new active tab is set successfully
function* refetchFilesWorker(action: SetActiveTabSuccess) {
  yield put(fetchFilesRequest(action.tab.path, !!action.pushToHistory));
}

function* tabSaga() {
  yield all([
    takeLatest(selectStatus('SET_ACTIVE_TAB', 'SUCCESS'), refetchFilesWorker)
  ]);
}

export default tabSaga;
