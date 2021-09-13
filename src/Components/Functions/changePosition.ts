import storage from 'electron-json-storage-sync';
import Translate from '../I18n/i18n';
import { changeSelectedStatus } from '../Shortcut/shortcut';
import path from 'path';
import windowGUID from '../Constants/windowGUID';

/**
 * Change current tab position
 * @param {string} newPath - the new position you want to open
 * @returns {void}
 */
const changePosition = (newPath: string): void => {
	document.querySelector<HTMLInputElement>('.path-navigator').value = newPath;
	document.getElementById('workspace').dataset.path = escape(newPath);

	const tabs = storage.get(`tabs-${windowGUID}`)?.data;
	console.log(tabs);
	const _focusingTab = tabs.tabs[String(tabs.focus)];
	_focusingTab.position = newPath;
	console.log(_focusingTab.history, _focusingTab.currentIndex);

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
		.querySelector<HTMLInputElement>('#tab-position').innerText = Translate(
		path.basename(newPath) === '' ? newPath : path.basename(newPath)
	);
	storage.set(`tabs-${windowGUID}`, tabs);
	changeSelectedStatus();
	return;
};

export default changePosition;
