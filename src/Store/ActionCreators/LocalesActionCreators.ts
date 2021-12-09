import {
  IAvailableLocales, ILocales,
  FetchLocalesFailure, FetchLocalesRequest, FetchLocalesSuccess
} from "../../Typings/Store/locales";

export const fetchLocalesRequest = (): FetchLocalesRequest => ({
  type: 'FETCH_LOCALES',
  status: 'REQUEST'
});

export const fetchLocalesSuccess = (locales: ILocales, availableLocales: IAvailableLocales): FetchLocalesSuccess => ({
  type: 'FETCH_LOCALES',
  status: 'SUCCESS',
  locales,
  availableLocales
});

export const fetchLocalesFailure = (message: string): FetchLocalesFailure => ({
  type: 'FETCH_LOCALES',
  status: 'FAILURE',
  message
});
