import { invoke } from "@tauri-apps/api";
import { IDrive, IUniqueDrive } from '../Typings/Store/drive';

/**
 * List all user's drives
 * @returns {Promise<Drive[]>}
 */
export const fetchDrives = async (platform: string): Promise<IDrive[]> => {
  const drives = await invoke<{ array_of_drives: IDrive[] }>('get_drives');
  let filteredDrives = drives.array_of_drives.filter(drive => drive.available_space > 0);
  if (platform !== 'win32') filteredDrives = filteredDrives.filter(d => d.is_removable);
  return filteredDrives;
}

// ! This should be a helper function
export const fetchUniqueDrives = (drives: IDrive[]): IUniqueDrive[] => drives
  .map((drive) => ({
    mount_point: drive.mount_point, name: drive.name && /[^?]/.test(drive.name)
      ? drive.name
      : drive.disk_type
  }));


// ! Not implementing detectChange, inefficient and memory leak within setInterval timer not being clearable
// export const detectChange = async (callback: () => void): Promise<void> => {
//   const drives = await fetchDrives();
//   const _drives = JSON.stringify(fetchUniqueDrives(drives));
//   const interval = setInterval(async () => {

//   })
// }
