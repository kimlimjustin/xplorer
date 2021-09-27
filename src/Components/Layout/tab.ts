import { updateTheme } from '../Theme/theme';
import { BrowserWindow } from '@electron/remote';
import storage from 'electron-json-storage-sync';
import Translate from '../I18n/i18n';
import windowGUID from '../Constants/windowGUID';

/**
 * Function to create new tab
 * @param {string} path - path to be focused on the new tab
 * @returns {void}
 */

const createNewTab = (path?: string): void => {
	const createNewTabElement = document.querySelector('.create-new-tab');
	const tabsInfo = storage.get(`tabs-${windowGUID}`)?.data; // Fetch latest tabs information

	const newTab = document.createElement('div');
	newTab.classList.add('tab');
	newTab.classList.add('tab-hover-effect');
	newTab.innerHTML = `<span id='tab-position'>${Translate(
		'Home'
	)}</span><span class='close-tab-btn'>&times;</span>`;
	tabsInfo.latestIndex += 1;
	newTab.dataset.tabIndex = tabsInfo.latestIndex;
	newTab.id = `tab${tabsInfo.latestIndex}`;

	updateTheme(); // Update the theme
	// Listen to close tab button
	newTab.querySelector('.close-tab-btn').addEventListener('click', (e) => {
		e.stopPropagation();
		// Close the window if user close the only tab
		if (document.querySelectorAll('.tab').length === 1) {
			const electronWindow = BrowserWindow.getFocusedWindow();
			electronWindow.close();
		} else {
			const tabs = storage.get(`tabs-${windowGUID}`)?.data;
			tabs.focusHistory = tabs.focusHistory.filter(
				(tabIndex: number) =>
					String(tabIndex) !== String(newTab.dataset.tabIndex)
			);
			if (String(tabsInfo.focus) === String(newTab.dataset.tabIndex))
				tabs.focus = String(
					tabs.focusHistory[tabs.focusHistory.length - 1]
				);
			delete tabs.tabs[newTab.dataset.tabIndex];
			storage.set(`tabs-${windowGUID}`, tabs);
			newTab.parentElement.removeChild(newTab);

			const { open } = require('../Files/File Operation/open'); //eslint-disable-line
			open(tabs.tabs[tabs.focus].position);
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
	storage.set(`tabs-${windowGUID}`, tabsInfo);

	const { open } = require('../Files/File Operation/open'); //eslint-disable-line
	open(path || 'xplorer://Home');

	newTab.addEventListener('click', () => {
		SwitchTab(newTab.dataset.tabIndex);
	});
	return;
};

/**
 * Function to switch between tab
 * @param {number|string} tabIndex - tab index to be switched into
 * @returns {void}
 */
const SwitchTab = (tabIndex: number | string): void => {
	const tabs = storage.get(`tabs-${windowGUID}`)?.data;
	tabs.focus = String(tabIndex);
	tabs.focusHistory.push(parseInt(String(tabIndex)));
	tabs.tabs[tabs.focus].currentIndex -= 1;
	storage.set(`tabs-${windowGUID}`, tabs);
	const { open } = require('../Files/File Operation/open'); //eslint-disable-line
	open(tabs.tabs[tabIndex].position);
};

/**
 * Function to navigate backward
 * @returns {void}
 */
const goBack = (): void => {
	const tabs = storage.get(`tabs-${windowGUID}`)?.data;
	const { open } = require('../Files/File Operation/open'); //eslint-disable-line
	const _focusingTab = tabs.tabs[tabs.focus];
	if (_focusingTab.currentIndex > 0) {
		open(_focusingTab.history[_focusingTab.currentIndex - 1]);
	}
};

/**
 * Function to navigate forward
 * @returns {void}
 */
const goForward = (): void => {
	const tabs = storage.get(`tabs-${windowGUID}`)?.data;
	const { open } = require('../Files/File Operation/open'); //eslint-disable-line
	const _focusingTab = tabs.tabs[tabs.focus];
	if (
		_focusingTab.currentIndex >= 0 &&
		_focusingTab.history?.[_focusingTab.currentIndex + 1]
	) {
		open(_focusingTab.history[_focusingTab.currentIndex + 1]);
	}
};
/**
 * Tab initiliazer function
 * @returns {void}
 */
const Tab = (): void => {
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
	storage.set(`tabs-${windowGUID}`, tabsInfo);

	// Add close tab button
	document.querySelectorAll<HTMLElement>('.tab').forEach((tab, index) => {
		const closeTab = document.createElement('span');
		closeTab.innerHTML = '&times;';
		tab.dataset.tabIndex = String(index + 1);
		closeTab.classList.add('close-tab-btn');
		// Listen to close tab button
		closeTab.addEventListener('click', (e) => {
			e.stopPropagation();
			// Close the window if user close the only tab
			if (document.querySelectorAll('.tab').length === 1) {
				const electronWindow = BrowserWindow.getFocusedWindow();
				electronWindow.close();
			} else {
				tab.parentElement.removeChild(tab);
				const tabs = storage.get(`tabs-${windowGUID}`)?.data;
				tabs.focusHistory = tabs.focusHistory.filter(
					(tabIndex: number) => tabIndex !== index + 1
				);
				tabs.focus = String(
					tabs.focusHistory[tabs.focusHistory.length - 1]
				);
				delete tabs.tabs[index + 1];
				storage.set(`tabs-${windowGUID}`, tabs);

				const { open } = require('../Files/File Operation/open'); //eslint-disable-line
				open(tabs.tabs[tabs.focus].position);
			}
		});
		tab.appendChild(closeTab);

		tab.querySelector<HTMLElement>('#tab-position').innerText = Translate(
			tab.querySelector<HTMLElement>('#tab-position').innerText
		);

		tab.addEventListener('click', () => {
			SwitchTab(index + 1);
		});
	});

	const createNewTabElement = document.querySelector('.create-new-tab');

	// Create a new tab event
	createNewTabElement.addEventListener('click', () => createNewTab());

	// Scroll the tabs
	document
		.querySelector('.tabs-manager')
		.addEventListener('wheel', (e: WheelEvent) => {
			e.deltaY > 0
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
