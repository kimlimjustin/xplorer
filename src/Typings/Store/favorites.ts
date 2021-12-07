import { AppActionBase } from "./actions";

export interface IFavorites {
  DOCUMENT_PATH: string,
  DOWNLOAD_PATH: string,
  DESKTOP_PATH: string,
  PICTURE_PATH: string,
  MUSIC_PATH: string,
  VIDEO_PATH: string,
  HOMEDIR_PATH: string
}

export const FETCH_FAVORITES = 'FETCH_FAVORITES';

export type FetchFavoritesRequest = AppActionBase<typeof FETCH_FAVORITES, 'REQUEST'> & {};
export type FetchFavoritesSuccess = AppActionBase<typeof FETCH_FAVORITES, 'SUCCESS'> & { favorites: IFavorites };
export type FetchFavoritesFailure = AppActionBase<typeof FETCH_FAVORITES, 'FAILURE'> & { message: string };
