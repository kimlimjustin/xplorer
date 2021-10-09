import os from 'os';
import storage from 'electron-json-storage-sync';
import windowGUID from '../Constants/windowGUID';

/**
 * Get the tab focusing path
 * @returns {string}
 */
const focusingPath = (): string => {
	const tabs = storage.get(`tabs-${windowGUID}`)?.data;
	return tabs.tabs[tabs.focus].position === 'xplorer://Home' &&
		process.platform === 'linux'
		? os.homedir()
		: tabs.tabs[tabs.focus].position;
};

export default focusingPath;
