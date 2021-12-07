import { AppActionBase } from "./actions";

export interface IAppReducerState {
  vscodeIntstalled: boolean,
  availableFonts: string[]
}

export const FETCH_VSCODE_INSTALLED = 'FETCH_VSCODE_INSTALLED';
export const FETCH_AVAILABLE_FONTS = 'FETCH_AVAILABLE_FONTS';

export type FetchVSCodeInstalledRequest = AppActionBase<typeof FETCH_VSCODE_INSTALLED, 'REQUEST'> & {};
export type FetchVSCodeInstalledSuccess = AppActionBase<typeof FETCH_VSCODE_INSTALLED, 'SUCCESS'> & { vscodeInstalled: boolean };
export type FetchVSCodeInstalledFailure = AppActionBase<typeof FETCH_VSCODE_INSTALLED, 'FAILURE'> & { message: string };

export type FetchAvailableFontsRequest = AppActionBase<typeof FETCH_AVAILABLE_FONTS, 'REQUEST'> & {};
export type FetchAvailableFontsSuccess = AppActionBase<typeof FETCH_AVAILABLE_FONTS, 'SUCCESS'> & { fonts: string[] };
export type FetchAvailableFontsFailure = AppActionBase<typeof FETCH_AVAILABLE_FONTS, 'FAILURE'> & { message: string };

export type AppActions = FetchVSCodeInstalledRequest | FetchVSCodeInstalledSuccess | FetchVSCodeInstalledFailure
  | FetchAvailableFontsRequest | FetchAvailableFontsSuccess | FetchAvailableFontsFailure;

export type AppActionTypes = typeof FETCH_VSCODE_INSTALLED | typeof FETCH_AVAILABLE_FONTS;
