import { invoke } from "@tauri-apps/api/core";

export const getOS = async (): Promise<string> => {
    const currentPlatform = await invoke<string>("get_platform");
    return currentPlatform;
};
