import { WebviewWindow } from "@tauri-apps/api/window";

import { AppActionBase } from "./actions";

export interface IWindowReducerState {
  windows: Record<string, WebviewWindow>
}

export const LISTEN_WINDOW_CLOSE = 'LISTEN_WINDOW_CLOSE';
export const CREATE_WINDOW = 'CREATE_WINDOW';
export const CHANGE_WINDOW_TITLE = 'CHANGE_WINDOW_TITLE';
export const SET_DECORATIONS = 'SET_DECORATIONS';

export type ListenWindowCloseRequest = AppActionBase<typeof LISTEN_WINDOW_CLOSE, 'REQUEST'> & {};
export type ListenWindowCloseSuccess = AppActionBase<typeof LISTEN_WINDOW_CLOSE, 'SUCCESS'> & {};
export type ListenWindowCloseFailure = AppActionBase<typeof LISTEN_WINDOW_CLOSE, 'FAILURE'> & { message: string };

export type CreateNewWindowRequest = AppActionBase<typeof CREATE_WINDOW, 'REQUEST'> & {};
export type CreateNewWindowSuccess = AppActionBase<typeof CREATE_WINDOW, 'SUCCESS'> & { window: WebviewWindow };
export type CreateNewWindowFailure = AppActionBase<typeof CREATE_WINDOW, 'FAILURE'> & { message: string };

export type ChangeWindowTitleRequest = AppActionBase<typeof CHANGE_WINDOW_TITLE, 'REQUEST'> & { title: string };
export type ChangeWindowTitleSuccess = AppActionBase<typeof CHANGE_WINDOW_TITLE, 'SUCCESS'> & {};
export type ChangeWindowTitleFailure = AppActionBase<typeof CHANGE_WINDOW_TITLE, 'FAILURE'> & { message: string };

export type SetDecorationsRequest = AppActionBase<typeof SET_DECORATIONS, 'REQUEST'> & { decorations: boolean };
export type SetDecorationsSuccess = AppActionBase<typeof SET_DECORATIONS, 'SUCCESS'> & {};
export type SetDecorationsFailure = AppActionBase<typeof SET_DECORATIONS, 'FAILURE'> & { message: string };

export type WindowActions = ListenWindowCloseRequest | ListenWindowCloseSuccess | ListenWindowCloseFailure
  | CreateNewWindowRequest | CreateNewWindowSuccess | CreateNewWindowFailure
  | ChangeWindowTitleRequest | ChangeWindowTitleSuccess | ChangeWindowTitleFailure
  | SetDecorationsRequest | SetDecorationsSuccess | SetDecorationsFailure;

export type WindowActionTypes = typeof LISTEN_WINDOW_CLOSE | typeof CREATE_WINDOW | typeof CHANGE_WINDOW_TITLE | typeof SET_DECORATIONS;
