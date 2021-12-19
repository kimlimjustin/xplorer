import { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrent } from "@tauri-apps/api/window";
import { all, call, takeLatest } from "redux-saga/effects";

import {
  cancelDirectorySearchFailure,
  cancelDirectorySearchRequest,
  cancelDirectorySearchSuccess,
  directorySearchPartialResultFailure,
  directorySearchPartialResultSuccess,
  fetchDirectorySizeFailure,
  fetchDirectorySizeSuccess,
  fetchFileExistsFailure, fetchFileExistsSuccess,
  fetchFilesFailure, fetchFilesSuccess,
  fetchIsDirectoryFailure, fetchIsDirectorySuccess,
  directorySearchFailure,
  directorySearchSuccess,
  listenDirectoryFailure, listenDirectorySuccess,
  makeDirectoryFailure, makeDirectorySuccess,
  unlistenDirectoryFailure, unlistenDirectorySuccess,
  pushHistory,
  updateHistoryIdxFailure,
  updateHistoryIdxSuccess
} from "../ActionCreators/DirectoryActionCreators";

import {
  IDirectoryMeta,
  CancelDirectorySearchRequest,
  FetchDirectorySizeRequest,
  FetchFileExistsRequest,
  FetchFilesRequest,
  FetchIsDirectoryRequest,
  InitDirectorySearchRequest,
  ListenDirectoryRequest,
  MakeDirectoryRequest,
  UnlistenDirectoryRequest,
  UpdateHistoryIdxRequest
} from "../../Typings/Store/directory";

import { selectStatus, typedPut as put, typedSelect as select } from "./helpers";
import { setActiveTab } from "../ActionCreators/TabActionCreators";
import * as DirectoryService from "../../Services/DirectoryService";
import FileMetaData from "../../Typings/fileMetaData";
import { ITab } from "../../Typings/Store/tab";

function* fetchFilesWorker(action: FetchFilesRequest) {
  try {
    const { dirName } = action;
    const meta: IDirectoryMeta = yield call(DirectoryService.fetchFiles, dirName);
    yield put(fetchFilesSuccess(dirName, meta));
    if (action.pushToHistory) yield put(pushHistory(dirName));
  } catch (error) {
    yield put(fetchFilesFailure(error.message));
  }
}

function* isDirectoryWorker(action: FetchIsDirectoryRequest) {
  try {
    const { path } = action;
    const isDirectory: boolean = yield call(DirectoryService.isDirectory, path);
    yield put(fetchIsDirectorySuccess(isDirectory));
  } catch (error) {
    yield put(fetchIsDirectoryFailure(error.message));
  }
}

function* fileExistsWorker(action: FetchFileExistsRequest) {
  try {
    const { filePath } = action;
    const fileExists: boolean = yield call(DirectoryService.fileExists, filePath);
    yield put(fetchFileExistsSuccess(fileExists));
  } catch (error) {
    yield put(fetchFileExistsFailure(error.message));
  }
}

function* makeDirectoryWorker(action: MakeDirectoryRequest) {
  try {
    const { dirPath } = action;
    yield call(DirectoryService.makeDirectory, dirPath);
    yield put(makeDirectorySuccess());
  } catch (error) {
    yield put(makeDirectoryFailure(error.message));
  }
}

function* listenDirectoryWorker(action: ListenDirectoryRequest) {
  try {
    const { dirName, callback } = action;
    const listener: UnlistenFn = yield call(DirectoryService.listenDirectory, dirName, callback);
    yield put(listenDirectorySuccess(dirName, listener));
  } catch (error) {
    yield put(listenDirectoryFailure(error.message));
  }
}

function* unlistenDirectoryWorker(action: UnlistenDirectoryRequest) {
  try {
    const { dirName } = action;
    const listener: UnlistenFn = yield select(state => state.directory.listeners?.[dirName]);
    if (listener) yield call(DirectoryService.unlistenDirectory, listener);
    yield put(unlistenDirectorySuccess(dirName));
  } catch (error) {
    yield put(unlistenDirectoryFailure(error.message));
  }
}

function* fetchDirectorySizeWorker(action: FetchDirectorySizeRequest) {
  try {
    const { dirName } = action;
    const directorySize: number = yield call(DirectoryService.fetchDirectorySize, dirName);
    yield put(fetchDirectorySizeSuccess(dirName, directorySize));
  } catch (error) {
    yield put(fetchDirectorySizeFailure(error.message));
  }
}

function* directorySearchPartialResultWorker(callback: (partialResult: FileMetaData[]) => void) {
  try {
    const listener: UnlistenFn = yield getCurrent().listen<FileMetaData[]>('search_partial_result', (event) => {
      callback(event.payload);
      put(directorySearchPartialResultSuccess(event.payload));
    });
    return listener;
  } catch (error) {
    yield put(directorySearchPartialResultFailure(error.message));
  }
}

function* initDirectorySearchWorker(action: InitDirectorySearchRequest) {
  try {
    const { dirName, pattern, callback } = action;
    const listener = yield* directorySearchPartialResultWorker(callback); // Handle partial results
    const result: FileMetaData[] = yield call(DirectoryService.initDirectorySearch, dirName, pattern);
    yield put(directorySearchSuccess(result));
    yield put(cancelDirectorySearchRequest(dirName, listener)); // Clear search
  } catch (error) {
    yield put(directorySearchFailure(error.message));
  }
}

function* cancelDirectorySearchWorker(action: CancelDirectorySearchRequest) {
  try {
    const { dirName, listener } = action;
    yield call(DirectoryService.cancelDirectorySearch, listener);
    yield put(cancelDirectorySearchSuccess(dirName));
  } catch (error) {
    yield put(cancelDirectorySearchFailure(error.message));
  }
}

function* updateHistoryIdxWorker(action: UpdateHistoryIdxRequest) {
  try {
    const maxHistoryIdx: number = yield select(state => state.directory.history.length);

    // Index needs to be lower than the length of the history
    if (action.idx > maxHistoryIdx) {
      yield put(updateHistoryIdxSuccess(maxHistoryIdx))
      return;
    }

    // Index needs to be geq 0
    if (action.idx < 0) {
      yield put(updateHistoryIdxSuccess(0));
      return
    }

    // Get path at location in history
    const path: string = yield select(state => state.directory.history?.[action.idx]);
    if (!path) throw new Error(`Invalid history index of ${action.idx}`);

    // Update directory reducer
    yield put(updateHistoryIdxSuccess(action.idx));

    // Update active tab
    const activeTab: ITab = yield select(state => state.tabs.activeTab);
    yield put(setActiveTab({ ...activeTab, path }, false));
  } catch (error) {
    yield put(updateHistoryIdxFailure(error.message));
  }
}

function* directorySaga() {
  yield all([
    takeLatest(selectStatus('FETCH_FILES'), fetchFilesWorker),
    // takeLatest(selectStatus('UPDATE_HISTORY_IDX', 'SUCCESS'), fetchFilesWorker), // Refetches when history is updated
    takeLatest(selectStatus('IS_DIRECTORY'), isDirectoryWorker),
    takeLatest(selectStatus('FETCH_FILE_EXISTS'), fileExistsWorker),
    takeLatest(selectStatus('MAKE_DIRECTORY'), makeDirectoryWorker),
    takeLatest(selectStatus('LISTEN_DIRECTORY'), listenDirectoryWorker),
    takeLatest(selectStatus('UNLISTEN_DIRECTORY'), unlistenDirectoryWorker),
    takeLatest(selectStatus('FETCH_DIRECTORY_SIZE'), fetchDirectorySizeWorker),
    takeLatest(selectStatus('INIT_DIRECTORY_SEARCH'), initDirectorySearchWorker),
    takeLatest(selectStatus('CANCEL_DIRECTORY_SEARCH'), cancelDirectorySearchWorker),
    takeLatest(selectStatus('UPDATE_HISTORY_IDX'), updateHistoryIdxWorker)
  ]);
}

export default directorySaga;
