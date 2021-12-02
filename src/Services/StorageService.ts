/* eslint-disable @typescript-eslint/no-explicit-any */
import { invoke } from "@tauri-apps/api";

/**
 * Set information to local storage
 * @param {string} key - Information key
 * @param {any} data - Your data
 * @returns {Promise<void>}
 */
export const writeData = async (key: string, data: any): Promise<void> => invoke('write_data', { key, data: JSON.stringify(data) });

/**
 * Get information from local storage
 * @param {string} key - Information key
 * @returns {Promise<any>} - Your data
 */
export const readData = async (key: string): Promise<any> => {
  const { data, status } = await invoke<{ status: boolean, data: any }>('read_data', { key });
  return status ? JSON.parse(data) : {};
}

/**
 * Remove a data
 * @param {string} key
 * @returns {any}
 */
export const removeData = async (key: string): Promise<void> => invoke('delete_storage_data', { key });
