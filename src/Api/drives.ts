import { invoke } from '@tauri-apps/api/tauri';
interface Drive {
	name: string;
	mount_point: string;
	total_space: number;
	available_space: number;
	is_removable: boolean;
}

class DrivesAPI {
	get(): Promise<Drive[]> {
		return new Promise((resolve) => {
			invoke('get_drives').then((drives: { array_of_drives: Drive[] }) =>
				resolve(drives.array_of_drives)
			);
		});
	}
}

export default DrivesAPI;
export { Drive };
