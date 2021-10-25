import Translate from '../I18n/i18n';
//import { changeSelectedStatus } from '../Shortcut/shortcut';
import windowGUID from '../Constants/windowGUID';
import Storage from '../../Api/storage';
import basename from './basename';
/**
 * Change current tab position
 * @param {string} newPath - the new position you want to open
 * @returns {Promise<void>}
 */
const changePosition = async (newPath: string): Promise<void> => {
	//closeWatcher();
	document.querySelector<HTMLInputElement>('.path-navigator').value = newPath;
	document.getElementById('workspace').dataset.path = escape(newPath);

	const tabs = await Storage.get(`tabs-${windowGUID}`);
	const _focusingTab = tabs?.tabs[String(tabs?.focus)];
	_focusingTab.position = newPath;

	if (newPath === _focusingTab.history[_focusingTab.currentIndex]) {
		return;
	} else if (
		newPath === _focusingTab.history[_focusingTab.currentIndex + 1]
	) {
		_focusingTab.currentIndex += 1;
	} else if (
		newPath === _focusingTab.history[_focusingTab.currentIndex - 1]
	) {
		_focusingTab.currentIndex -= 1;
	} else {
		_focusingTab.history = _focusingTab.history.slice(
			0,
			_focusingTab.currentIndex + 1
		);
		_focusingTab.history.push(newPath);
		_focusingTab.currentIndex += 1;
	}
	tabs.tabs[String(tabs.focus)] = _focusingTab;
	document
		.getElementById(`tab${tabs.focus}`)
		.querySelector<HTMLInputElement>('#tab-position').innerText =
		await Translate(basename(newPath) === '' ? newPath : basename(newPath));
	Storage.set(`tabs-${windowGUID}`, tabs);
	//changeSelectedStatus();
	return;
};

export default changePosition;
