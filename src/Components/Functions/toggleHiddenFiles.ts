import { MAIN_BOX_ELEMENT } from '../../Util/constants';
import Storage from '../../Service/storage';
const toggleHiddenFiles = async (): Promise<void> => {
	const _preference = await Storage.get('preference');
	const hideHiddenFiles = !_preference?.hideHiddenFiles;
	_preference.hideHiddenFiles = hideHiddenFiles;
	MAIN_BOX_ELEMENT().dataset.hideHiddenFiles = String(hideHiddenFiles);
	Storage.set('preference', _preference);
};
export default toggleHiddenFiles;
