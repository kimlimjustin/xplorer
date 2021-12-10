import { all, call, takeLatest } from "redux-saga/effects";

import {
  fetchAvailableFontsFailure, fetchAvailableFontsSuccess,
  fetchVSCodeInstalledFailure, fetchVSCodeInstalledSuccess
} from '../ActionCreators/AppActionCreators';

import { selectStatus, typedPut as put } from './helpers';
import * as AppService from '../../Services/AppService';

function* fetchVSCodeInstalledWorker() {
  try {
    const isVSCodeInstalled: boolean = yield call(AppService.fetchVSCodeInstalled);
    yield put(fetchVSCodeInstalledSuccess(isVSCodeInstalled));
  } catch (error) {
    yield put(fetchVSCodeInstalledFailure(error.message));
  }
}

function* fetchAvailableFontsWorker() {
  try {
    const availableFonts: string[] = yield call(AppService.fetchAvailableFonts);
    yield put(fetchAvailableFontsSuccess(availableFonts));
  } catch (error) {
    yield put(fetchAvailableFontsFailure(error.message))
  }
}

function* appSaga() {
  yield all([
    takeLatest(selectStatus('FETCH_VSCODE_INSTALLED'), fetchVSCodeInstalledWorker),
    takeLatest(selectStatus('FETCH_AVAILABLE_FONTS'), fetchAvailableFontsWorker)
  ]);
}

export default appSaga;
