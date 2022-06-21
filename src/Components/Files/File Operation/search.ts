import Translate from '../../I18n/i18n';
import focusingPath from '../../Functions/focusingPath';
import DirectoryAPI from '../../../Service/directory';
import { startLoading, stopLoading } from '../../Functions/Loading/loading';
import displayFiles from '../../Open/displayFiles';
import changePosition from '../../Functions/changePosition';
import { LOAD_IMAGE } from '../../Functions/lazyLoadingImage';
import { updateTheme } from '../../Theme/theme';
import { OpenLog } from '../../Functions/log';
import { OpenDir } from '../../Open/open';
import isTauri from '../../../Util/is-tauri';
import { GET_TAB_ELEMENT } from '../../../Util/constants';
let being_watch: string;

const stopSearchingProcess = async (): Promise<void> => {
	being_watch = null;
	if (await new DirectoryAPI('').stopSearching()) stopLoading();
};

/**
 * Process searching
 * @param {string} to_search - glob pattern to search
 * @param {string} search_in - dir to search into
 * @returns {Promise<void>}
 */
const processSearch = async (to_search: string, search_in: string): Promise<void> => {
	const MAIN_ELEMENT = GET_TAB_ELEMENT();
	MAIN_ELEMENT.innerHTML = '';
	if (!to_search.length) OpenDir(search_in);
	startLoading();
	const search_path = `Search: [[${to_search}]] inside [[${search_in}]]`;
	changePosition(search_path);
	let foundSomething = false;

	const finalResult = await new DirectoryAPI(search_in).search(to_search, async (partialFound) => {
		let _el = document.createElement('div') as HTMLElement;
		foundSomething = true;
		if (document.querySelector<HTMLInputElement>('.path-navigator').value.startsWith('Search: '))
			_el = await displayFiles(partialFound, search_path, _el, null, true);
		for (const childEl of _el.children) {
			MAIN_ELEMENT.appendChild(childEl);
		}
	});
	const _el = document.createElement('div');
	MAIN_ELEMENT.appendChild(await displayFiles(finalResult, search_path, _el, null, true));
	if (!finalResult.length && !foundSomething) {
		MAIN_ELEMENT.classList.add('empty-dir-notification');
		MAIN_ELEMENT.innerText = "Can't find specified query";
	}
	stopLoading();
	updateTheme('grid');
	LOAD_IMAGE();
	OpenLog(search_path);
};

/**
 * Get the real focusing path
 * @returns {Promise<string>}
 */
const getFocusingPath = async (): Promise<string> => {
	let _focusingPath = await focusingPath();
	if (_focusingPath.startsWith('Search: ')) {
		const splitByInsideKeyword = _focusingPath.split(' inside ');
		if (splitByInsideKeyword.length === 2) {
			_focusingPath = splitByInsideKeyword[1].slice(2, -2);
		} else {
			for (let i = 0; i < splitByInsideKeyword.length; i++) {
				if (splitByInsideKeyword[i]?.endsWith(']]') && splitByInsideKeyword[i + 1]?.startsWith('[[')) {
					_focusingPath = splitByInsideKeyword
						.slice(i + 1)
						.join(' inside ')
						.slice(2, -2);
				}
			}
		}
	}
	return _focusingPath;
};
/**
 * Initialize search feature in Xplorer
 * @returns {Promise<void>}
 */
const Search = async (): Promise<void> => {
	let listener: ReturnType<typeof setTimeout>;
	const searchElement = document.querySelector<HTMLInputElement>('.search-bar');
	if (!isTauri) {
		searchElement.setAttribute('disabled', '');
	}
	searchElement.placeholder = `🔎 ${await Translate('Search')}`;
	searchElement.addEventListener('keydown', async (e: KeyboardEvent) => {
		clearTimeout(listener);
		if (e.ctrlKey && e.key === 'f') {
			return;
		} else if (e.key === 'Enter') {
			const value = (e.target as HTMLInputElement).value;
			if (value !== being_watch) {
				processSearch(value, await getFocusingPath());
				being_watch = value;
			}
		} else {
			listener = setTimeout(async () => {
				const value = (e.target as HTMLInputElement).value;
				if (value === '') {
					OpenDir(await getFocusingPath());
				} else if (value !== being_watch) {
					processSearch(value, await getFocusingPath());
					being_watch = value;
				}
			}, 1000);
		}
	});
};
export default Search;
export { processSearch, stopSearchingProcess };
