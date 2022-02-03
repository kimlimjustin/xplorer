import Translate from '../I18n/i18n';
import { changeSelectedAllStatus } from '../Shortcut/shortcut';
import windowName from '../../Service/window';
import Storage from '../../Service/storage';
import basename from './path/basename';
import { UpdateInfo } from '../Layout/infobar';
import { GET_TAB_ELEMENT } from '../../Util/constants';
/**
 * Change current tab position
 * @param {string} newPath - the new position you want to open
 * @param {boolean} forceChange - force changing position
 * @param {boolean} writeHistory - write open directory history to storage
 * @returns {Promise<void>}
 */
const changePosition = async (newPath: string, forceChange = false, writeHistory?: boolean): Promise<void> => {
	document.querySelector<HTMLInputElement>('.path-navigator').value = newPath;
	GET_TAB_ELEMENT().dataset.path = encodeURI(newPath);
	if (!writeHistory) return;

	const tabs = await Storage.get(`tabs-${windowName}`);
	const _focusingTab = tabs?.tabs[String(tabs?.focus)];
	_focusingTab.position = newPath;

	if (newPath === _focusingTab.history[_focusingTab.currentIndex] && !forceChange) {
		return;
	} else if (newPath === _focusingTab.history[_focusingTab.currentIndex + 1]) {
		_focusingTab.currentIndex += 1;
	} else if (newPath === _focusingTab.history[_focusingTab.currentIndex - 1]) {
		_focusingTab.currentIndex -= 1;
	} else {
		_focusingTab.history = _focusingTab.history.slice(0, _focusingTab.currentIndex + 1);
		_focusingTab.history.push(newPath);
		_focusingTab.currentIndex += 1;
	}
	tabs.tabs[String(tabs.focus)] = _focusingTab;

	document.getElementById(`tab${tabs.focus}`).querySelector<HTMLInputElement>('#tab-position').innerText = await Translate(
		document.querySelector<HTMLInputElement>('.path-navigator').value.startsWith('Search: ')
			? newPath
			: basename(newPath) === ''
			? newPath
			: basename(newPath)
	);
	Storage.set(`tabs-${windowName}`, tabs);
	UpdateInfo('selected-files', '');
	changeSelectedAllStatus();
	return;
};

export default changePosition;
