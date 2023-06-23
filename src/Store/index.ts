import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import { createLogger } from "redux-logger";

import rootSaga from "./Sagas";
import rootReducer, { IAppState } from "./Reducers";

const sagaMiddleware = createSagaMiddleware();
const loggerMiddleware = createLogger();

const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware, loggerMiddleware),
});

sagaMiddleware.run(rootSaga);

export default store;
