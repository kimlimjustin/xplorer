import { Actions } from "../../Typings/Store/store";
import { IConfigReducerState } from "../../Typings/Store/config";

const initialState: IConfigReducerState = {
  background: '#1a1b26',
  opacity: 0, // 0.95
  fontFamily: 'system-ui',
  fontSize: 16,
  theme: 'Dark',
  appLang: 'English'
};

const reducer = (state = initialState, action: Actions): IConfigReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'UPDATE_CONFIG':
      return {
        ...state,
        ...action.updates
      };
    default:
      return state;
  }
};

export default reducer;
