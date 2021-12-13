import { IRequestReducerState } from "../../Typings/Store/request";
import { Actions } from "../../Typings/Store/store";

const initialState: IRequestReducerState = {};

const reducer = (state = initialState, action: Actions): IRequestReducerState => {
  return {
    ...state,
    [action.type]: {
      status: action.status,
      requestTime: (action.status === 'REQUEST'
        ? new Date()
        : state[action.type]?.requestTime ?? null
      ),
      completedTime: (action.status === 'SUCCESS' || action.status === 'FAILURE'
        ? new Date()
        : state[action.type]?.completedTime ?? null
      )
    }
  }
};

export default reducer;
