import { IDriveReducerState } from "../../Typings/Store/drive";
import { Actions } from "../../Typings/Store/store";

const initialState: IDriveReducerState = {
  drives: {}
};

const reducer = (state = initialState, action: Actions): IDriveReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'FETCH_DRIVES':
      return {
        ...state,
        drives: action.drives.reduce(
          (accum, curr) => ({ ...accum, [curr.name]: curr }),
          {}
        )
      };
    default:
      return state;
  }
};

export default reducer;
