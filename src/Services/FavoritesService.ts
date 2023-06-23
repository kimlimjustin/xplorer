import { path } from "@tauri-apps/api";

import { IFavorites } from "../Typings/Store/favorites";

export const fetchFavorites = async (): Promise<IFavorites> => ({
    Documents: await path.documentDir(),
    Downloads: await path.downloadDir(),
    Desktop: await path.downloadDir(),
    Pictures: await path.pictureDir(),
    Music: await path.audioDir(),
    Videos: await path.videoDir(),
    Home: await path.homeDir(),
});
