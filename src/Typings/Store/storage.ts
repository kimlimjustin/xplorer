import { AppActionBase } from "./actions";

export const WRITE_DATA = 'WRITE_DATA';
export const READ_DATA = 'READ_DATA';
export const REMOVE_DATA = 'REMOVE_DATA';

export type WriteDataRequest = AppActionBase<typeof WRITE_DATA, 'REQUEST'> & { key: string, data: any };
export type WriteDataSuccess = AppActionBase<typeof WRITE_DATA, 'SUCCESS'> & {};
export type WriteDataFailure = AppActionBase<typeof WRITE_DATA, 'FAILURE'> & { message: string };

export type ReadDataRequest = AppActionBase<typeof READ_DATA, 'REQUEST'> & { key: string };
export type ReadDataSuccess = AppActionBase<typeof READ_DATA, 'SUCCESS'> & { data: any };
export type ReadDataFailure = AppActionBase<typeof READ_DATA, 'FAILURE'> & { message: string };

export type RemoveDataRequest = AppActionBase<typeof REMOVE_DATA, 'REQUEST'> & { key: string };
export type RemoveDataSuccess = AppActionBase<typeof REMOVE_DATA, 'SUCCESS'> & {};
export type RemoveDataFailure = AppActionBase<typeof REMOVE_DATA, 'FAILURE'> & { message: string };
