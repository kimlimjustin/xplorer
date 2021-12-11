import { IClipboardState } from "../../Typings/Store/clipboard";
import { Actions } from "../../Typings/Store/store";

const initialState: IClipboardState = {
  text: ''
};

const reducer = (state = initialState, action: Actions): IClipboardState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'WRITE_TO_CLIPBOARD':
    case 'READ_FROM_CLIPBOARD':
      return {
        ...state,
        text: action.text
      };
    default:
      return state;
  }
};

export default reducer;
