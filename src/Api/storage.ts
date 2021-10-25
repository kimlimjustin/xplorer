/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { invoke } from '@tauri-apps/api';

/**
 * Set information to local storage
 * @param {string} key - Information key
 * @param {any} data - Your data
 * @returns {Promise<void>}
 */
const set = async (key: string, data: any): Promise<void> => {
	await invoke('write_data', { key, data: JSON.stringify(data) });
};

/**
 * Get information from local storage
 * @param {string} key - Information key
 * @returns {Promise<any>} - Your data
 */
const get = async (key: string): Promise<any> => {
	interface returnedType {
		status: boolean;
		data: any;
	}
	const returnedData = (await invoke('read_data', { key })) as returnedType;
	return returnedData.status ? JSON.parse(returnedData.data) : {};
};

/**
 * Remove a data
 * @param {string} key
 * @returns {any}
 */
const remove = async (key: string): Promise<void> => {
	await invoke('delete_storage_data', { key });
};

const Storage = { set, get, remove };
export default Storage;
