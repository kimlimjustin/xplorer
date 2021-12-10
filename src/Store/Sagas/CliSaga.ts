import { all, call, takeLatest } from "redux-saga/effects";

import { fetchCliInformationFailure, fetchCliInformationSuccess } from "../ActionCreators/CliActionCreators";

import { selectStatus, typedPut as put } from "./helpers";
import * as CliService from "../../Services/CliService";
import { ICliArguments } from "../../Typings/Store/cli";

function* fetchCliInformationWorker() {
  try {
    const cliInformation: ICliArguments = yield call(CliService.fetchCliInformation);
    yield put(fetchCliInformationSuccess(cliInformation));
  } catch (error) {
    yield put(fetchCliInformationFailure(error.message));
  }
}

function* cliSaga() {
  yield all([
    takeLatest(selectStatus('FETCH_CLI_INFORMATION'), fetchCliInformationWorker)
  ]);
}

export default cliSaga;
