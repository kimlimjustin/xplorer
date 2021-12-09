import { ILocalesReducerState } from "../../Typings/Store/locales";
import { Actions } from "../../Typings/Store/store";

const initialState: ILocalesReducerState = {
  locales: {},
  availableLocales: {}
};

const reducer = (state = initialState, action: Actions): ILocalesReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'FETCH_LOCALES':
      return {
        ...state,
        locales: action.locales,
        availableLocales: action.availableLocales
      };
    default:
      return state;
  }
};

export default reducer;
