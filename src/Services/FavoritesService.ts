import { path } from "@tauri-apps/api";

import { IFavorites } from '../Typings/Store/favorites';

export const fetchFavorites = async (): Promise<IFavorites> => ({
  DOCUMENT_PATH: await path.documentDir(),
  DOWNLOAD_PATH: await path.downloadDir(),
  DESKTOP_PATH: await path.downloadDir(),
  PICTURE_PATH: await path.pictureDir(),
  MUSIC_PATH: await path.audioDir(),
  VIDEO_PATH: await path.videoDir(),
  HOMEDIR_PATH: await path.homeDir()
});
