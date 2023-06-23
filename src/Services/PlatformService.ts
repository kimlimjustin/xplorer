import { os } from "@tauri-apps/api";

export const getOS = async (): Promise<string> => {
    return await os.platform();
};
