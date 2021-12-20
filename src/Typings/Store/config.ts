import { AppActionBase } from "./actions";

export type AppTheme = 'Light' | 'Dark';

export interface IConfigReducerState {
  background: string,
  opacity: number,
  fontFamily: string,
  fontSize: number,
  theme: AppTheme,
  appLang: string
}

export const UPDATE_CONFIG = 'UPDATE_CONFIG'; // * Internal

export type UpdateConfigSuccess = AppActionBase<typeof UPDATE_CONFIG, 'SUCCESS'> & { updates: Partial<IConfigReducerState> };

export type ConfigActions = UpdateConfigSuccess;
export type ConfigActionTypes = typeof UPDATE_CONFIG;
