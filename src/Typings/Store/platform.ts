import { AppActionBase } from "./actions";

export const GET_OS = 'GET_OS';

export type GetOSRequest = AppActionBase<typeof GET_OS, 'REQUEST'> & {};
export type GetOSSuccess = AppActionBase<typeof GET_OS, 'SUCCESS'> & { os: string };
export type GetOSFailure = AppActionBase<typeof GET_OS, 'FAILURE'> & { message: string };

export type PlatformActions = GetOSRequest | GetOSSuccess | GetOSFailure;

export type PlatformActionTypes = typeof GET_OS;
