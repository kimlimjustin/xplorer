import { all, call, takeLatest } from "redux-saga/effects";

import { fetchLocalesFailure, fetchLocalesSuccess } from "../ActionCreators/LocalesActionCreators";

import { selectStatus, typedPut as put } from "./helpers";
import * as LocalesService from "../../Services/LocaleService";
import { IAvailableLocales, ILocales } from "../../Typings/Store/locales";

function* fetchLocalesWorker(/* action: FetchLocalesRequest */) {
  try {
    const { locales, availableLocales }: { locales: ILocales, availableLocales: IAvailableLocales } = yield call(LocalesService.fetchLocales);
    yield put(fetchLocalesSuccess(locales, availableLocales));
  } catch (error) {
    yield put(fetchLocalesFailure(error.message));
  }
}

function* localeSaga() {
  yield all([
    takeLatest(selectStatus('FETCH_LOCALES'), fetchLocalesWorker)
  ]);
}

export default localeSaga;
