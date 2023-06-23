import { AppActionBase } from "./actions";

// * Allows for iteration over objects of type IFavorites, IFavoritesReducerState
interface IFavoritesBase {
    [k: string]: string;
}

export interface IFavorites extends IFavoritesBase {
    Documents: string;
    Downloads: string;
    Desktop: string;
    Pictures: string;
    Music: string;
    Videos: string;
    Home: string;
}

export interface IFavoritesReducerState extends IFavorites {}

export const FETCH_FAVORITES = "FETCH_FAVORITES";

export type FetchFavoritesRequest = AppActionBase<typeof FETCH_FAVORITES, "REQUEST"> & {};
export type FetchFavoritesSuccess = AppActionBase<typeof FETCH_FAVORITES, "SUCCESS"> & { favorites: IFavorites };
export type FetchFavoritesFailure = AppActionBase<typeof FETCH_FAVORITES, "FAILURE"> & { message: string };

export type FavoritesActions = FetchFavoritesRequest | FetchFavoritesSuccess | FetchFavoritesFailure;

export type FavoritesActionTypes = typeof FETCH_FAVORITES;
