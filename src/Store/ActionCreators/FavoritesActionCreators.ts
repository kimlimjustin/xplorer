import {
  IFavorites,
  FetchFavoritesRequest, FetchFavoritesSuccess, FetchFavoritesFailure
} from "../../Typings/Store/favorites";

export const fetchFavoritesRequest = (): FetchFavoritesRequest => ({
  type: 'FETCH_FAVORITES',
  status: 'REQUEST'
});

export const fetchFavoritesSuccess = (favorites: IFavorites): FetchFavoritesSuccess => ({
  type: 'FETCH_FAVORITES',
  status: 'SUCCESS',
  favorites
});

export const fetchFavoritesFailure = (message: string): FetchFavoritesFailure => ({
  type: 'FETCH_FAVORITES',
  status: 'FAILURE',
  message
});
