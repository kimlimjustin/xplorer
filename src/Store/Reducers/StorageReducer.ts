import omit from 'lodash.omit';

import { IStorageReducerState } from "../../Typings/Store/storage";
import { Actions } from "../../Typings/Store/store";

const initialState: IStorageReducerState = {
  store: {}
};

const reducer = (state = initialState, action: Actions): IStorageReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    // * Don't need to handle
    // case 'WRITE_DATA':
    //   return {
    //     ...state
    //   };
    case 'READ_DATA':
      return {
        ...state,
        store: {
          ...state.store,
          [action.key]: action.data
        }
      };
    case 'REMOVE_DATA':
      return {
        ...state,
        store: omit(state.store, action.key)
      };
    default:
      return state;
  }
};

export default reducer;
