import { AppActionBase } from "./actions";

export interface IAvailableLocales {
  [key: string]: string
}

export interface ILocales {
  [key: string]: {
    [key: string]: string
  }
}

export interface ILocalesReducerState {
  locales: ILocales,
  availableLocales: IAvailableLocales
}

export const FETCH_LOCALES = 'FETCH_LOCALES';

export type FetchLocalesRequest = AppActionBase<typeof FETCH_LOCALES, 'REQUEST'> & {};
export type FetchLocalesSuccess = AppActionBase<typeof FETCH_LOCALES, 'SUCCESS'> & { locales: ILocales, availableLocales: IAvailableLocales };
export type FetchLocalesFailure = AppActionBase<typeof FETCH_LOCALES, 'FAILURE'> & { message: string };

export type LocalesActions = FetchLocalesRequest | FetchLocalesSuccess | FetchLocalesFailure;

export type LocalesActionTypes = typeof FETCH_LOCALES;
