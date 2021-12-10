import { all, call, takeLatest } from "redux-saga/effects";
import { WebviewWindow } from "@tauri-apps/api/window";

import {
  changeWindowTitleFailure, changeWindowTitleSuccess,
  createNewWindowFailure, createNewWindowSuccess,
  listenWindowCloseFailure, listenWindowCloseSuccess,
  setDecorationsFailure, setDecorationsSuccess
} from "../ActionCreators/WindowActionCreators";

import {
  ChangeWindowTitleRequest,
  CreateNewWindowRequest,
  SetDecorationsRequest
} from "../../Typings/Store/window";

import { selectStatus, typedPut as put } from "./helpers";
import * as WindowService from "../../Services/WindowService";

function* listenWindowCloseWorker(/* action: ListenWindowCloseRequest */) {
  try {
    yield call(WindowService.listenWindowClose);
    yield put(listenWindowCloseSuccess());
  } catch (error) {
    yield put(listenWindowCloseFailure(error.message));
  }
}

function* createNewWindowWorker(action: CreateNewWindowRequest) {
  try {
    const { title } = action;
    const window: WebviewWindow = yield call(WindowService.createNewWindow, title);
    yield put(createNewWindowSuccess(title, window));
  } catch (error) {
    yield put(createNewWindowFailure(error.message));
  }
}

function* changeWindowTitleWorker(action: ChangeWindowTitleRequest) {
  try {
    const { title, dest } = action;
    yield call(WindowService.changeWindowTitle, title);
    yield put(changeWindowTitleSuccess(title, dest));
  } catch (error) {
    yield put(changeWindowTitleFailure(error.message));
  }
}

function* setDecorationsWorker(action: SetDecorationsRequest) {
  try {
    const { decorations } = action;
    yield call(WindowService.setDecorations, decorations);
    yield put(setDecorationsSuccess());
  } catch (error) {
    yield put(setDecorationsFailure(error.message));
  }
}

function* windowSaga() {
  yield all([
    takeLatest(selectStatus('LISTEN_WINDOW_CLOSE'), listenWindowCloseWorker),
    takeLatest(selectStatus('CREATE_WINDOW'), createNewWindowWorker),
    takeLatest(selectStatus('CHANGE_WINDOW_TITLE'), changeWindowTitleWorker),
    takeLatest(selectStatus('SET_DECORATIONS'), setDecorationsWorker),
  ]);
}

export default windowSaga;
