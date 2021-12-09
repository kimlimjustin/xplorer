import {
  FetchVSCodeInstalledRequest, FetchVSCodeInstalledSuccess, FetchVSCodeInstalledFailure,
  FetchAvailableFontsRequest, FetchAvailableFontsSuccess, FetchAvailableFontsFailure
} from "../../Typings/Store/app";

export const fetchVSCodeInstalledRequest = (): FetchVSCodeInstalledRequest => ({
  type: 'FETCH_VSCODE_INSTALLED',
  status: 'REQUEST'
});

export const fetchVSCodeInstalledSuccess = (vscodeInstalled: boolean): FetchVSCodeInstalledSuccess => ({
  type: 'FETCH_VSCODE_INSTALLED',
  status: 'SUCCESS',
  vscodeInstalled
});

export const fetchVSCodeInstalledFailure = (message: string): FetchVSCodeInstalledFailure => ({
  type: 'FETCH_VSCODE_INSTALLED',
  status: 'FAILURE',
  message
});

export const fetchAvailableFontsRequest = (): FetchAvailableFontsRequest => ({
  type: 'FETCH_AVAILABLE_FONTS',
  status: 'REQUEST'
});

export const fetchAvailableFontsSuccess = (fonts: string[]): FetchAvailableFontsSuccess => ({
  type: 'FETCH_AVAILABLE_FONTS',
  status: 'SUCCESS',
  fonts
});

export const fetchAvailableFontsFailure = (message: string): FetchAvailableFontsFailure => ({
  type: 'FETCH_AVAILABLE_FONTS',
  status: 'FAILURE',
  message
});

