import {
  ICliArguments,
  FetchCliInformationRequest, FetchCliInformationSuccess, FetchCliInformationFailure
} from "../../Typings/Store/cli";

export const fetchCliInformationRequest = (): FetchCliInformationRequest => ({
  type: 'FETCH_CLI_INFORMATION',
  status: 'REQUEST'
});

export const fetchCliInformationSuccess = (cliArguments: ICliArguments): FetchCliInformationSuccess => ({
  type: 'FETCH_CLI_INFORMATION',
  status: 'SUCCESS',
  cliArguments
});

export const fetchCliInformationFailure = (message: string): FetchCliInformationFailure => ({
  type: 'FETCH_CLI_INFORMATION',
  status: 'FAILURE',
  message
});
