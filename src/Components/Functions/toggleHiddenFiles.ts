import Storage from '../../Service/storage';
const toggleHiddenFiles = async (): Promise<void> => {
	const _preference = await Storage.get('preference');
	const hideHiddenFiles = !_preference?.hideHiddenFiles;
	_preference.hideHiddenFiles = hideHiddenFiles;
	document.getElementById('workspace').dataset.hideHiddenFiles = String(hideHiddenFiles);
	Storage.set('preference', _preference);
};
export default toggleHiddenFiles;
