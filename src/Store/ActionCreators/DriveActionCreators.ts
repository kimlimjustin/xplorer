import {
  IDrive,
  FetchDrivesFailure, FetchDrivesRequest, FetchDrivesSuccess
} from "../../Typings/Store/drive";

export const fetchDrivesRequest = (): FetchDrivesRequest => ({
  type: 'FETCH_DRIVES',
  status: 'REQUEST'
});

export const fetchDrivesSuccess = (drives: IDrive[]): FetchDrivesSuccess => ({
  type: 'FETCH_DRIVES',
  status: 'SUCCESS',
  drives
});

export const fetchDrivesFailure = (message: string): FetchDrivesFailure => ({
  type: 'FETCH_DRIVES',
  status: 'FAILURE',
  message
});
