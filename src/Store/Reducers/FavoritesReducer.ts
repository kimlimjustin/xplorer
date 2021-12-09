import { IFavoritesReducerState } from "../../Typings/Store/favorites";
import { Actions } from "../../Typings/Store/store";

const initialState: IFavoritesReducerState = {
  DOCUMENT_PATH: null,
  DOWNLOAD_PATH: null,
  DESKTOP_PATH: null,
  PICTURE_PATH: null,
  MUSIC_PATH: null,
  VIDEO_PATH: null,
  HOMEDIR_PATH: null
};

const reducer = (state = initialState, action: Actions): IFavoritesReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'FETCH_FAVORITES':
      return {
        ...state,
        DOCUMENT_PATH: action.favorites.DOCUMENT_PATH,
        DOWNLOAD_PATH: action.favorites.DOWNLOAD_PATH,
        DESKTOP_PATH: action.favorites.DESKTOP_PATH,
        PICTURE_PATH: action.favorites.PICTURE_PATH,
        MUSIC_PATH: action.favorites.MUSIC_PATH,
        VIDEO_PATH: action.favorites.VIDEO_PATH,
        HOMEDIR_PATH: action.favorites.HOMEDIR_PATH
      };
    default:
      return state;
  }
};

export default reducer;
