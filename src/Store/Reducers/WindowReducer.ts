import omit from 'lodash.omit';

import { Actions } from "../../Typings/Store/store";
import { IWindowReducerState } from "../../Typings/Store/window";

const initialState: IWindowReducerState = {
  windows: {}
};

const reducer = (state = initialState, action: Actions): IWindowReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    // * Don't need to handle
    // case 'LISTEN_WINDOW_CLOSE':
    //   return {
    //     ...state
    //   };
    case 'CREATE_WINDOW':
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.title]: action.window
        }
      };
    case 'CHANGE_WINDOW_TITLE':
      return {
        ...state,
        windows: {
          ...omit(state.windows, action.title),
          [action.dest]: state.windows?.[action.title] || null
        }
      };
    // * Don't need to handle
    // case 'SET_DECORATIONS':
    //   return {
    //     ...state
    //   };
    default:
      return state;
  }
};

export default reducer;
