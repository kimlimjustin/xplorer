import { ActionStatus } from "./actions";

export interface IRequest {
  status: ActionStatus,
  requestTime: Date,
  completedTime: Date,
  // attempts: number // Currently unimplemented, for future use
}

export interface IRequestReducerState {
  [key: string]: IRequest // action type -> request meta
}
