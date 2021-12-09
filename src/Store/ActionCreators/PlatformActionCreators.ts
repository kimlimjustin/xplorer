import {
  GetOSFailure, GetOSRequest, GetOSSuccess
} from "../../Typings/Store/platform";

export const getOSRequest = (): GetOSRequest => ({
  type: 'GET_OS',
  status: 'REQUEST'
});

export const getOSSuccess = (os: string): GetOSSuccess => ({
  type: 'GET_OS',
  status: 'SUCCESS',
  os
});

export const getOSFailure = (message: string): GetOSFailure => ({
  type: 'GET_OS',
  status: 'FAILURE',
  message
});
