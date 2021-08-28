import storage from 'electron-json-storage-sync';
const userPreference = storage.get('preference')?.data; // Read user preference
let hideHiddenFiles = userPreference ? userPreference?.hideHiddenFiles : true; // Hide hidden files as default

const __init__ = () => {
	document.getElementById('workspace').dataset.hideHiddenFiles =
		hideHiddenFiles;
};

const getHideHiddenFilesValue = (): boolean => hideHiddenFiles;
const toggleHideHiddenFilesValue = (): void => {
	hideHiddenFiles = !hideHiddenFiles;
};

/**
 * Show/hide hidden files
 * @returns {void}
 */
const toggleHiddenFiles = (): void => {
	__init__();
};

export {
	toggleHiddenFiles,
	getHideHiddenFilesValue,
	toggleHideHiddenFilesValue,
};
