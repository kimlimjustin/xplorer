import { updateTheme } from '../Theme/theme';
import Storage from '../../Api/storage';
import Translate from '../I18n/i18n';
import windowGUID from '../Constants/windowGUID';
import { OpenDir } from '../Files/File Operation/open';
import { close } from './windowManager';
/**
 * Function to create new tab
 * @param {string} path - path to be focused on the new tab
 * @returns {Promise<void>}
 */

const createNewTab = async (path?: string): Promise<void> => {
	const createNewTabElement = document.querySelector('.create-new-tab');
	const tabsInfo = await Storage.get(`tabs-${windowGUID}`); // Fetch latest tabs information

	const newTab = document.createElement('div');
	newTab.classList.add('tab');
	newTab.classList.add('tab-hover-effect');
	newTab.innerHTML = `<span id='tab-position'>${await Translate(
		'Home'
	)}</span><span class='close-tab-btn'>&times;</span>`;
	tabsInfo.latestIndex += 1;
	newTab.dataset.tabIndex = tabsInfo.latestIndex;
	newTab.id = `tab${tabsInfo.latestIndex}`;

	updateTheme(); // Update the theme
	// Listen to close tab button
	newTab
		.querySelector('.close-tab-btn')
		.addEventListener('click', async (e) => {
			e.stopPropagation();
			// Close the window if user close the only tab
			if (document.querySelectorAll('.tab').length === 1) {
				close();
			} else {
				const tabs = await Storage.get(`tabs-${windowGUID}`);
				tabs.focusHistory = tabs.focusHistory.filter(
					(tabIndex: number) =>
						String(tabIndex) !== String(newTab.dataset.tabIndex)
				);
				if (String(tabsInfo.focus) === String(newTab.dataset.tabIndex))
					tabs.focus = String(
						tabs.focusHistory[tabs.focusHistory.length - 1]
					);
				delete tabs.tabs[newTab.dataset.tabIndex];
				Storage.set(`tabs-${windowGUID}`, tabs);
				newTab.parentElement.removeChild(newTab);

				OpenDir(tabs.tabs[tabs.focus].position);
			}
		});
	createNewTabElement.parentElement.insertBefore(newTab, createNewTabElement); // Insert the new tab
	(newTab.parentNode as HTMLElement).scrollLeft =
		window.pageXOffset +
		newTab.getBoundingClientRect().left +
		newTab.offsetWidth; // Scroll the tabs scrollbar

	// Scroll the tab to the right end
	(newTab.parentNode as HTMLElement).scrollLeft = (
		newTab.parentNode as HTMLElement
	).scrollWidth;

	// Edit tabs information
	tabsInfo.tabs[String(tabsInfo.latestIndex)] = {
		position: path || 'xplorer://Home',
		history: ['xplorer://Home'],
		currentIndex: -1,
	};
	tabsInfo.focus = String(tabsInfo.latestIndex);
	tabsInfo.focusHistory.push(tabsInfo.latestIndex);
	Storage.set(`tabs-${windowGUID}`, tabsInfo);

	OpenDir(path || 'xplorer://Home');

	newTab.addEventListener('click', () => {
		SwitchTab(newTab.dataset.tabIndex);
	});
	return;
};

/**
 * Function to switch between tab
 * @param {number|string} tabIndex - tab index to be switched into
 * @returns {Promise<void>}
 */
const SwitchTab = async (tabIndex: number | string): Promise<void> => {
	const tabs = await Storage.get(`tabs-${windowGUID}`);
	tabs.focus = String(tabIndex);
	tabs.focusHistory.push(parseInt(String(tabIndex)));
	tabs.tabs[tabs.focus].currentIndex -= 1;
	Storage.set(`tabs-${windowGUID}`, tabs);
	OpenDir(tabs.tabs[tabIndex].position);
};

/**
 * Function to navigate backward
 * @returns {Promise<void>}
 */
const goBack = async (): Promise<void> => {
	const tabs = await Storage.get(`tabs-${windowGUID}`);
	const _focusingTab = tabs.tabs[tabs.focus];
	console.log(_focusingTab);
	if (_focusingTab.currentIndex > 0) {
		OpenDir(_focusingTab.history[_focusingTab.currentIndex - 1]);
	}
};

/**
 * Function to navigate forward
 * @returns {Promise<void>}
 */
const goForward = async (): Promise<void> => {
	const tabs = await Storage.get(`tabs-${windowGUID}`);
	const _focusingTab = tabs.tabs[tabs.focus];
	if (
		_focusingTab.currentIndex >= 0 &&
		_focusingTab.history?.[_focusingTab.currentIndex + 1]
	) {
		OpenDir(_focusingTab.history[_focusingTab.currentIndex + 1]);
	}
};
/**
 * Tab initiliazer function
 * @returns {Promise<void>}
 */
const Tab = async (): Promise<void> => {
	const tabsInfo = {
		focus: '1',
		tabs: {
			1: {
				position: 'xplorer://Home',
				history: ['xplorer://Home'],
				currentIndex: 0,
			},
		},
		focusHistory: [1],
		latestIndex: 1,
	}; // default tabs information
	// Store default tabs information into local storage
	Storage.set(`tabs-${windowGUID}`, tabsInfo);

	const arrayOfTabs = document.querySelectorAll<HTMLElement>('.tab');
	// Add close tab button
	for (let index = 0; index < arrayOfTabs.length; index++) {
		const tab = arrayOfTabs[index];
		const closeTab = document.createElement('span');
		closeTab.innerHTML = '&times;';
		tab.dataset.tabIndex = String(index + 1);
		closeTab.classList.add('close-tab-btn');
		// Listen to close tab button
		closeTab.addEventListener('click', async (e) => {
			e.stopPropagation();
			// Close the window if user close the only tab
			if (document.querySelectorAll('.tab').length === 1) {
				close();
			} else {
				tab.parentElement.removeChild(tab);
				const tabs = await Storage.get(`tabs-${windowGUID}`);
				tabs.focusHistory = tabs.focusHistory.filter(
					(tabIndex: number) => tabIndex !== index + 1
				);
				tabs.focus = String(
					tabs.focusHistory[tabs.focusHistory.length - 1]
				);
				delete tabs.tabs[index + 1];
				Storage.set(`tabs-${windowGUID}`, tabs);

				OpenDir(tabs.tabs[tabs.focus].position);
			}
		});
		tab.appendChild(closeTab);

		tab.querySelector<HTMLElement>('#tab-position').innerText =
			await Translate(
				tab.querySelector<HTMLElement>('#tab-position').innerText
			);

		tab.addEventListener('click', () => {
			SwitchTab(index + 1);
		});
	}

	const createNewTabElement = document.querySelector('.create-new-tab');

	// Create a new tab event
	createNewTabElement.addEventListener('click', () => createNewTab());

	// Scroll the tabs
	document.querySelector('.tabs-manager').addEventListener('wheel', (e) => {
		(e as WheelEvent).deltaY > 0
			? (document.querySelector('.tabs-manager').scrollLeft += 25)
			: (document.querySelector('.tabs-manager').scrollLeft -= 25);
	});

	document
		.getElementById('go-back')
		.addEventListener('click', () => goBack());
	document
		.getElementById('go-forward')
		.addEventListener('click', () => goForward());
};

export { Tab, createNewTab, goBack, goForward };
