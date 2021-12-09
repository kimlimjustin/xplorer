import { IAppReducerState } from "../../Typings/Store/app";
import { Actions } from "../../Typings/Store/store";

const initialState: IAppReducerState = {
  vscodeIntstalled: false,
  availableFonts: []
};


const reducer = (state = initialState, action: Actions): IAppReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'FETCH_VSCODE_INSTALLED':
      return {
        ...state,
        vscodeIntstalled: action.vscodeInstalled
      };
    case 'FETCH_AVAILABLE_FONTS':
      return {
        ...state,
        availableFonts: action.fonts
      };
    default:
      return state;
  }
};

export default reducer;
