import { updateTheme } from '../Theme/theme';
import Storage from '../../Service/storage';
import Translate from '../I18n/i18n';
import windowName from '../../Service/window';
import { OpenDir } from '../Open/open';
import { close } from './windowManager';
import basename from '../Functions/path/basename';
import Home from './home';
import { GET_WORKSPACE_ELEMENT } from '../../Util/constants';
import changePosition from '../Functions/changePosition';

let tabsManager: HTMLElement;
document.addEventListener('DOMContentLoaded', () => {
	tabsManager = document.querySelector('.tabs-manager');
});
/**
 * Function to create new tab
 * @param {string} path - path to be focused on the new tab
 * @returns {Promise<void>}
 */

const createNewTab = async (path?: string): Promise<void> => {
	const createNewTabElement = document.querySelector('.create-new-tab');
	const tabsInfo = await Storage.get(`tabs-${windowName}`); // Fetch latest tabs information

	const newTab = document.createElement('div');
	newTab.classList.add('tab');
	newTab.classList.add('tab-hover-effect');
	newTab.innerHTML = `<span id='tab-position'>${await Translate('Home')}</span><span class='close-tab-btn'>&times;</span>`;
	tabsInfo.latestIndex += 1;
	newTab.dataset.tabIndex = tabsInfo.latestIndex;
	newTab.id = `tab${tabsInfo.latestIndex}`;

	updateTheme('tabbing'); // Update the theme
	createNewTabElement.parentElement.insertBefore(newTab, createNewTabElement); // Insert the new tab
	(newTab.parentNode as HTMLElement).scrollLeft = window.pageXOffset + newTab.getBoundingClientRect().left + newTab.offsetWidth; // Scroll the tabs scrollbar

	// Scroll the tab to the right end
	(newTab.parentNode as HTMLElement).scrollLeft = (newTab.parentNode as HTMLElement).scrollWidth;

	// Edit tabs information
	tabsInfo.tabs[String(tabsInfo.latestIndex)] = {
		position: path || 'xplorer://Home',
		history: ['xplorer://Home'],
		currentIndex: -1,
	};
	tabsInfo.focus = String(tabsInfo.latestIndex);
	tabsInfo.focusHistory.push(tabsInfo.latestIndex);
	Storage.set(`tabs-${windowName}`, tabsInfo);

	const newWorkspaceTabElement = document.createElement('div');
	newWorkspaceTabElement.classList.add('workspace-tab');
	newWorkspaceTabElement.id = `tab-1-${tabsInfo.latestIndex}`;
	newWorkspaceTabElement.dataset.path = path || 'xplorer://Home';
	GET_WORKSPACE_ELEMENT(1).appendChild(newWorkspaceTabElement);

	document.querySelectorAll('.workspace-tab').forEach((tab: HTMLElement) => {
		tab.classList.remove('workspace-tab-active');
	});
	newWorkspaceTabElement.classList.add('workspace-tab-active');

	OpenDir(path || 'xplorer://Home');

	newTab.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).classList.contains('close-tab-btn')) return;
		SwitchTab(newTab.dataset.tabIndex);
	});
	if (tabsManager.scrollWidth > tabsManager.clientWidth) tabsManager.removeAttribute('data-tauri-drag-region');
	else tabsManager.setAttribute('data-tauri-drag-region', '');
	return;
};

/**
 * Function to switch between tab
 * @param {number|string} tabIndex - tab index to be switched into
 * @returns {Promise<void>}
 */
const SwitchTab = async (tabIndex: number | string): Promise<void> => {
	const tabs = await Storage.get(`tabs-${windowName}`);
	tabs.focus = String(tabIndex);
	tabs.focusHistory.push(parseInt(String(tabIndex)));
	tabs.tabs[tabs.focus].currentIndex -= 1;
	Storage.set(`tabs-${windowName}`, tabs);
	document.querySelectorAll('.workspace-tab').forEach((tab: HTMLElement) => {
		tab.classList.remove('workspace-tab-active');
	});
	document.getElementById(`tab-1-${tabIndex}`).classList.add('workspace-tab-active');
	changePosition(tabs.tabs[tabs.focus].position);
};

/**
 * Function to navigate backward
 * @returns {Promise<void>}
 */
const goBack = async (): Promise<void> => {
	const tabs = await Storage.get(`tabs-${windowName}`);
	const _focusingTab = tabs.tabs[tabs.focus];
	if (_focusingTab.currentIndex > 0) {
		OpenDir(_focusingTab.history[_focusingTab.currentIndex - 1]);
	}
};

/**
 * Function to navigate forward
 * @returns {Promise<void>}
 */
const goForward = async (): Promise<void> => {
	const tabs = await Storage.get(`tabs-${windowName}`);
	const _focusingTab = tabs.tabs[tabs.focus];
	if (_focusingTab.currentIndex >= 0 && _focusingTab.history?.[_focusingTab.currentIndex + 1]) {
		OpenDir(_focusingTab.history[_focusingTab.currentIndex + 1]);
	}
};
/**
 * Tab initiliazer function
 * @param {boolean} reveal - is the window opened in reveal mode
 * @returns {Promise<void>}
 */
const Tab = async (reveal = false): Promise<void> => {
	const _preference = await Storage.get('preference');
	const defaultTabsInfo = {
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
	if ((_preference?.on_startup ?? 'new') === 'new') {
		// Store default tabs information into local storage
		Storage.set(`tabs-${windowName}`, defaultTabsInfo);
		tabsManager.setAttribute('data-tauri-drag-region', '');
	} else {
		const tabsInfo = await Storage.get(`tabs-${windowName}`);
		if (!tabsInfo.tabs || reveal) {
			Storage.set(`tabs-${windowName}`, defaultTabsInfo);
			tabsManager.setAttribute('data-tauri-drag-region', '');
			Home();
		} else {
			let _first = true;
			const createNewTabElement = document.querySelector('.create-new-tab');
			for (const index in Object.keys(tabsInfo.tabs)) {
				if (_first) {
					const tabIndex = Object.keys(tabsInfo.tabs)[index];
					const tabPosition = tabsInfo.tabs[tabIndex].position;
					if (Object.keys(tabsInfo.tabs).length > 1) {
						document.querySelector('#tab1').id = `tab${tabIndex}`;
						document.querySelector('#tab-1-1').id = `tab-1-${Object.keys(tabsInfo.tabs)[index]}`;
					} else {
						document.querySelector('#tab1').id = `tab${Object.keys(tabsInfo.tabs)[index]}`;
						document.querySelector('#tab-1-1').id = `tab-1-${Object.keys(tabsInfo.tabs)[index]}`;
					}
					document.getElementById(`tab${tabIndex}`).querySelector<HTMLInputElement>('#tab-position').innerText = await Translate(
						basename(tabPosition) === '' ? tabPosition : basename(tabPosition)
					);
					await OpenDir(tabsInfo.tabs[Object.keys(tabsInfo.tabs)[index]].position, false, true, false);
					_first = false;
				} else {
					const tabIndex = Object.keys(tabsInfo.tabs)[index];
					const tabPosition = tabsInfo.tabs[tabIndex].position;
					const newTab = document.createElement('div');
					newTab.classList.add('tab');
					newTab.classList.add('tab-hover-effect');
					newTab.innerHTML = `<span id='tab-position'>${await Translate('Home')}</span><span class='close-tab-btn'>&times;</span>`;
					newTab.dataset.tabIndex = tabIndex;
					newTab.id = `tab${tabIndex}`;

					createNewTabElement.parentElement.insertBefore(newTab, createNewTabElement); // Insert the new tab
					document.getElementById(`tab${tabIndex}`).querySelector<HTMLInputElement>('#tab-position').innerText = await Translate(
						basename(tabPosition) === '' ? tabPosition : basename(tabPosition)
					);
					const newWorkspaceTabElement = document.createElement('div');
					newWorkspaceTabElement.classList.add('workspace-tab');
					newWorkspaceTabElement.id = `tab-1-${tabIndex}`;
					newWorkspaceTabElement.dataset.path = tabPosition || 'xplorer://Home';
					GET_WORKSPACE_ELEMENT(1).appendChild(newWorkspaceTabElement);

					document.querySelectorAll('.workspace-tab').forEach((tab: HTMLElement) => {
						tab.classList.remove('workspace-tab-active');
					});
					newWorkspaceTabElement.classList.add('workspace-tab-active');
					await OpenDir(tabPosition || 'xplorer://Home', false, true, false);
				}
			}
		}
	}
	updateTheme('tabbing'); // Update the theme

	const arrayOfTabs = document.querySelectorAll<HTMLElement>('.tab');
	// Add close tab button
	for (let index = 0; index < arrayOfTabs.length; index++) {
		const tab = arrayOfTabs[index];
		const closeTab = document.createElement('span');
		closeTab.innerHTML = '&times;';
		closeTab.title = await Translate('Close Tab');
		tab.dataset.tabIndex = String(parseInt(tab.id.replace('tab', ''))) || '1';
		closeTab.classList.add('close-tab-btn');
		tab.appendChild(closeTab);

		tab.querySelector<HTMLElement>('#tab-position').innerText = await Translate(tab.querySelector<HTMLElement>('#tab-position').innerText);

		tab.addEventListener('click', (e) => {
			if ((e.target as HTMLElement).classList.contains('close-tab-btn')) return;
			SwitchTab(String(parseInt(tab.id.replace('tab', ''))) || '1');
		});
	}

	document.addEventListener('click', async (e) => {
		if ((e.target as HTMLElement).classList.contains('close-tab-btn')) {
			e.stopPropagation();
			// Close the window if user close the only tab
			if (document.querySelectorAll('.tab').length === 1) {
				Storage.remove(`tabs-${windowName}`);
				close();
			} else {
				const tab = (e.target as HTMLElement).parentNode as HTMLElement;
				const index = parseInt(tab.dataset.tabIndex);
				tab.parentElement.removeChild(tab);
				const tabs = await Storage.get(`tabs-${windowName}`);
				tabs.focusHistory = tabs.focusHistory.filter((tabIndex: number) => tabIndex !== index);
				tabs.focus = String(tabs.focusHistory[tabs.focusHistory.length - 1]);
				delete tabs.tabs[index];
				Storage.set(`tabs-${windowName}`, tabs);
				OpenDir(tabs.tabs[tabs.focus].position);
				if (tabsManager.scrollWidth > tabsManager.clientWidth) tabsManager.removeAttribute('data-tauri-drag-region');
				else tabsManager.setAttribute('data-tauri-drag-region', '');
			}
		}
	});

	const createNewTabElement = document.querySelector('.create-new-tab');

	// Create a new tab event
	createNewTabElement.addEventListener('click', () => createNewTab());

	// Scroll the tabs
	document.querySelector('.tabs-manager').addEventListener('wheel', (e) => {
		(e as WheelEvent).deltaY > 0
			? (document.querySelector('.tabs-manager').scrollLeft += 25)
			: (document.querySelector('.tabs-manager').scrollLeft -= 25);
	});

	document.getElementById('go-back').addEventListener('click', () => goBack());
	document.getElementById('go-forward').addEventListener('click', () => goForward());
};

export { Tab, createNewTab, goBack, goForward };
