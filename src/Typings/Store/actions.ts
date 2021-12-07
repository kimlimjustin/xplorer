import { Action } from 'redux';

export type ActionStatus = 'REQUEST' | 'SUCCESS' | 'FAILURE';
export type AppActionBase<T, S extends ActionStatus> = Action<T> & { status: S };