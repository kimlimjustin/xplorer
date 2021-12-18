import omit from 'lodash.omit';

import { ITabReducerState } from "../../Typings/Store/tab";
import { Actions } from "../../Typings/Store/store";

const initialState: ITabReducerState = {
  tabs: {},
  activeTab: null
};

const reducer = (state = initialState, action: Actions): ITabReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'CREATE_TAB':
      return {
        ...state,
        tabs: {
          ...state.tabs,
          [action.tab.name]: action.tab
        }
      };
    case 'UPDATE_TAB':
      return {
        ...state,
        tabs: {
          ...state.tabs,
          [action.name]: {
            ...state.tabs?.[action.name] || {},
            ...action.tab
          }
        }
      };
    case 'DELETE_TAB':
      return {
        ...state,
        tabs: omit(state.tabs, action.name)
      };
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.tab
      }
    default:
      return state;
  }
};

export default reducer;
