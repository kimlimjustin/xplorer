import {
  ReadDataFailure, ReadDataRequest, ReadDataSuccess,
  RemoveDataFailure, RemoveDataRequest, RemoveDataSuccess,
  WriteDataFailure, WriteDataRequest, WriteDataSuccess
} from "../../Typings/Store/storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const writeDataRequest = (key: string, data: any): WriteDataRequest => ({
  type: 'WRITE_DATA',
  status: 'REQUEST',
  key,
  data
});

export const writeDataSuccess = (): WriteDataSuccess => ({
  type: 'WRITE_DATA',
  status: 'SUCCESS'
});

export const writeDataFailure = (message: string): WriteDataFailure => ({
  type: 'WRITE_DATA',
  status: 'FAILURE',
  message
});

export const readDataRequest = (key: string): ReadDataRequest => ({
  type: 'READ_DATA',
  status: 'REQUEST',
  key
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const readDataSuccess = (data: any): ReadDataSuccess => ({
  type: 'READ_DATA',
  status: 'SUCCESS',
  data
});

export const readDataFailure = (message: string): ReadDataFailure => ({
  type: 'READ_DATA',
  status: 'FAILURE',
  message
});

export const removeDataRequest = (key: string): RemoveDataRequest => ({
  type: 'REMOVE_DATA',
  status: 'REQUEST',
  key
});

export const removeDataSuccess = (): RemoveDataSuccess => ({
  type: 'REMOVE_DATA',
  status: 'SUCCESS'
});

export const removeDataFailure = (message: string): RemoveDataFailure => ({
  type: 'REMOVE_DATA',
  status: 'FAILURE',
  message
});
