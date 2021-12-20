import { IConfigReducerState, UpdateConfigSuccess } from "../../Typings/Store/config";

export const updateConfig = (updates: Partial<IConfigReducerState>): UpdateConfigSuccess => ({
  type: 'UPDATE_CONFIG',
  status: 'SUCCESS',
  updates
});
