import { AppActionBase } from "./actions";

export interface ICliArguments {
  args: string[];
  flags: string[];
}

export interface ICliReducerState extends ICliArguments {

}

export const FETCH_CLI_INFORMATION = 'FETCH_CLI_INFORMATION';

export type FetchCliInformationRequest = AppActionBase<typeof FETCH_CLI_INFORMATION, 'REQUEST'> & {};
export type FetchCliInformationSuccess = AppActionBase<typeof FETCH_CLI_INFORMATION, 'SUCCESS'> & { cliArguments: ICliArguments };
export type FetchCliInformationFailure = AppActionBase<typeof FETCH_CLI_INFORMATION, 'FAILURE'> & { message: string };

export type CliActions = FetchCliInformationRequest | FetchCliInformationSuccess | FetchCliInformationFailure;

export type CliActionTypes = typeof FETCH_CLI_INFORMATION;
