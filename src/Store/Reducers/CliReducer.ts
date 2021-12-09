import { ICliReducerState } from "../../Typings/Store/cli";
import { Actions } from "../../Typings/Store/store";

const initialState: ICliReducerState = {
  args: [],
  flags: []
};

const reducer = (state = initialState, action: Actions): ICliReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'FETCH_CLI_INFORMATION':
      return {
        ...state,
        args: action.cliArguments.args,
        flags: action.cliArguments.flags
      };
    default:
      return state;
  }
};

export default reducer;

