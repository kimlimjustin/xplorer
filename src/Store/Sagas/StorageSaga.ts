import { all, call, takeLatest } from "redux-saga/effects";

import {
  readDataFailure, readDataSuccess,
  removeDataFailure, removeDataSuccess,
  writeDataFailure, writeDataSuccess
} from "../ActionCreators/StorageActionCreators";

import {
  ReadDataRequest,
  RemoveDataRequest,
  WriteDataRequest
} from "../../Typings/Store/storage";

import { selectStatus, typedPut as put } from "./helpers";
import * as StorageService from "../../Services/StorageService";

function* writeDataWorker(action: WriteDataRequest) {
  try {
    const { key, data } = action;
    yield call(StorageService.writeData, key, data);
    yield put(writeDataSuccess());
  } catch (error) {
    yield put(writeDataFailure(error.message));
  }
}

function* readDataWorker(action: ReadDataRequest) {
  try {
    const { key } = action;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    const data: any = yield call(StorageService.readData, key);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    /* eslint-enable @typescript-eslint/ban-ts-comment */

    yield put(readDataSuccess(key, data));
  } catch (error) {
    yield put(readDataFailure(error.message));
  }
}

function* removeDataWorker(action: RemoveDataRequest) {
  try {
    const { key } = action;
    yield call(StorageService.removeData, key);
    yield put(removeDataSuccess(key));
  } catch (error) {
    yield put(removeDataFailure(error.message));
  }
}

function* storageSaga() {
  yield all([
    takeLatest(selectStatus('WRITE_DATA'), writeDataWorker),
    takeLatest(selectStatus('READ_DATA'), readDataWorker),
    takeLatest(selectStatus('REMOVE_DATA'), removeDataWorker)
  ]);
}

export default storageSaga;
