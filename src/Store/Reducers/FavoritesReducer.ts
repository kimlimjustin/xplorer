import { IFavoritesReducerState } from "../../Typings/Store/favorites";
import { Actions } from "../../Typings/Store/store";

const initialState: IFavoritesReducerState = {
    Documents: null,
    Downloads: null,
    Desktop: null,
    Pictures: null,
    Music: null,
    Videos: null,
    Home: null,
};

const reducer = (
    state = initialState,
    action: Actions
): IFavoritesReducerState => {
    if (action.status !== "SUCCESS") return state;

    switch (action.type) {
        case "FETCH_FAVORITES":
            return {
                ...state,
                Documents: action.favorites.Documents,
                Downloads: action.favorites.Downloads,
                Desktop: action.favorites.DESKTOP_PATH,
                Pictures: action.favorites.Pictures,
                Music: action.favorites.Music,
                Videos: action.favorites.Videos,
                Home: action.favorites.Home,
            };
        default:
            return state;
    }
};

export default reducer;
