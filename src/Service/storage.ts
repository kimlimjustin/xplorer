/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import isTauri from '../Util/is-tauri';
import IStorageData from '../Typings/storageData';

// Store fetched data into variable
const data: IStorageData = {};
/**
 * Set information to local storage
 * @param {string} key - Information key
 * @param {any} data - Your data
 * @returns {Promise<void>}
 */
const set = async (key: string, value: any): Promise<void> => {
	if (isTauri) {
		data[key] = value;
		const { invoke } = require('@tauri-apps/api');
		return await invoke('write_data', { key, value });
	} else {
		data[key] = value;
		localStorage.setItem(key, JSON.stringify(value));
	}
};

/**
 * Get information from local storage
 * @param {string} key - Information key
 * @param {boolean} force - Force fetcing the latest data
 * @returns {Promise<any>} - Your data
 */
const get = async (key: string, force?: boolean): Promise<any> => {
	interface returnedType {
		status: boolean;
		data: JSON;
	}
	if (Object.keys(data).includes(key) && !force) {
		return data[key];
	} else {
		if (isTauri) {
			const { invoke } = require('@tauri-apps/api');
			const returnedData = (await invoke('read_data', { key })) as returnedType;
			data[key] = returnedData.data;
			return returnedData.status ? returnedData.data : {};
		} else {
			const storedData = localStorage.getItem(key);
			if (storedData) {
				data[key] = JSON.parse(storedData);
				return data[key];
			} else {
				return {};
			}
		}
	}
};

/**
 * Remove a data
 * @param {string} key
 * @returns {any}
 */
const remove = async (key: string): Promise<void> => {
	if (isTauri) {
		const { invoke } = require('@tauri-apps/api');
		await invoke('delete_storage_data', { key });
	} else {
		localStorage.removeItem(key);
	}
};

export default { get, set, remove };
