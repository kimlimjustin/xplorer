import { GET_DRIVES_ENDPOINT } from '../Util/constants';
import isTauri from '../Util/is-tauri';
import OS from './platform';
interface Drive {
	name: string;
	mount_point: string;
	total_space: number;
	available_space: number;
	is_removable: boolean;
	disk_type: 'HDD' | 'SSD' | 'Removable Disk';
	file_system: string;
}

interface UniqueDrive {
	mount_point: string;
	name: string;
}

let platform: string;
(async () => {
	if (!platform) {
		platform = await OS();
	}
})();

/**
 * Invoke Rust command to list user's drive
 */
class DrivesAPI {
	DRIVES: Drive[];
	/**
	 * List all user's drives
	 * @returns {Promise<Drive[]>}
	 */
	get(): Promise<Drive[]> {
		return new Promise((resolve) => {
			if (isTauri) {
				const { invoke } = require('@tauri-apps/api');

				invoke('get_drives').then((drives: { array_of_drives: Drive[] }) => {
					let filteredDrives = drives.array_of_drives.filter((drive) => drive.available_space > 0);
					if (platform !== 'win32') {
						filteredDrives = filteredDrives.filter((drive) => drive.is_removable);
					}
					resolve(filteredDrives);
				});
			} else {
				fetch(GET_DRIVES_ENDPOINT, { method: 'GET' })
					.then((res) => res.json())
					.then((res: { array_of_drives: Drive[] }) => {
						let filteredDrives = res.array_of_drives.filter((drive) => drive.available_space > 0);
						if (platform !== 'win32') {
							filteredDrives = filteredDrives.filter((drive) => drive.is_removable);
						}
						resolve(filteredDrives);
					});
			}
		});
	}
	async build(): Promise<void> {
		this.DRIVES = await this.get();
	}
	/**
	 * Filter drives into unique drives regardless space
	 * @param {Array<Drive>} drives - drives array
	 * @returns {UniqueDrive[]} unique drives array
	 */
	getUniqueDrives(drives: Array<Drive>): Array<UniqueDrive> {
		const result: UniqueDrive[] = [];
		drives.forEach((drive) =>
			result.push({
				mount_point: drive.mount_point,
				name: drive.name && /[^?]/.test(drive.name) ? drive.name : drive.disk_type,
			})
		);
		return result;
	}
	/**
	 * Listen to drives state changes
	 * @param {() => void} cb Callback function
	 * @returns {Promise<void>}
	 */
	async detectChange(cb: () => void): Promise<void> {
		await this.build();
		let _drives = JSON.stringify(this.getUniqueDrives(this.DRIVES));
		setInterval(async () => {
			await this.build();
			const _refreshedDrive = JSON.stringify(this.getUniqueDrives(this.DRIVES));
			if (_refreshedDrive !== _drives) {
				cb();
			}
			_drives = _refreshedDrive;
		}, 500);
	}
}

export default DrivesAPI;
export { Drive };
