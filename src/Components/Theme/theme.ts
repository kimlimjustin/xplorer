import Storage from '../../Api/storage';
import { themeValue, themeData, Theme } from '../../Typings/theme';
/**
 * Detect system theme
 * @returns {string}
 */
const detectDefaultTheme = (): string => {
	if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	} else {
		return 'light';
	}
};

let defaultTheme = detectDefaultTheme();
const updateNativeTheme = (): void => {
	defaultTheme = detectDefaultTheme();
	updateTheme('*');
};

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
	defaultTheme = e.matches ? 'dark' : 'light';
	updateTheme('*');
});

let themeJSON: themeValue; // user preference theme json
import * as defaultThemeData from './theme.json';
const defaultThemeJSON: Theme = defaultThemeData;

let currentTheme: string;

/**
 * Get style of an element
 * @param {string} variable - What style you wanna get?
 * @param {string} theme - the current theme
 * @returns {string|null} style of the [variable] of the element
 */
const getElementStyle = (variable: string, theme?: string): string | null => {
	return themeJSON?.[variable] || defaultThemeJSON[theme ?? currentTheme]?.[variable];
};

/**
 * Change style of an element
 * @param {HTMLElement} element - Element you want to change the theme style
 * @param {string} variable - The style you wanna change
 * @param {any} key - CSS key of the style
 * @param {string} theme - current theme
 * @returns {void}
 */
const changeElementTheme = (element: HTMLElement, variable: string, key: string, theme: string): void => {
	if (element) (<any>element.style)[key] = themeJSON?.[variable] || defaultThemeJSON?.[theme]?.[variable]; //eslint-disable-line
};

const getXYCoordinates = (e: MouseEvent): { x: number; y: number } => {
	const rect = (e.target as Element).getBoundingClientRect();

	return {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
	};
};

/**
 * Change page theme
 * @param {string} theme - The current theme
 * @returns {Promise<void>}
 */
const changeTheme = async (
	theme?: string,
	category?:
		| '*'
		| 'root'
		| 'windowmanager'
		| 'tabbing'
		| 'settings'
		| 'favorites'
		| 'grid'
		| 'contextmenu'
		| 'prompt'
		| 'preview'
		| 'properties'
		| 'infobar'
): Promise<void> => {
	if (!category) category = '*';
	const appearance = await Storage.get('appearance');
	if (category === '*' || category === 'root') {
		document.body.style.setProperty('--edge-radius', appearance.frameStyle === 'os' ? '0px' : '10px');
		changeElementTheme(document.querySelector('.main-box'), 'mainBackground', 'background', theme);
		changeElementTheme(document.body, 'textColor', 'color', theme);
		if (appearance?.fontSize) {
			document.body.style.fontSize = appearance.fontSize;
			document.documentElement.style.fontSize = appearance.fontSize;
		} else changeElementTheme(document.body, 'fontSize', 'fontSize', theme);
		if (appearance?.fontFamily) {
			document.body.style.fontFamily = appearance.fontFamily;
			document.documentElement.style.fontFamily = appearance.fontFamily;
		} else changeElementTheme(document.body, 'fontFamily', 'fontFamily', theme);
		if (appearance?.transparentSidebar ?? true)
			document.body.style.setProperty('--sidebar-transparency', appearance?.windowTransparency ?? '0.9');
		if (appearance?.transparentWorkspace ?? false)
			document.body.style.setProperty('--workspace-transparency', appearance?.windowTransparency ?? '0.9');
		if (appearance?.transparentTopbar ?? false) document.body.style.setProperty('--topbar-transparency', appearance?.windowTransparency ?? '0.9');

		document.body.style.setProperty(
			'--scrollbar-track',
			themeJSON ? themeJSON.scrollbarTrackBackground : defaultThemeJSON[theme]?.scrollbarTrackBackground
		);
		document.body.style.setProperty(
			'--scrollbar-thumb',
			themeJSON ? themeJSON.scrollbarThumbBackground : defaultThemeJSON[theme]?.scrollbarThumbBackground
		);
		document.body.style.setProperty(
			'--scrollbar-thumb-hover',
			themeJSON ? themeJSON.scrollbarThumbHoverBackground : defaultThemeJSON[theme]?.scrollbarThumbHoverBackground
		);
		document.body.style.setProperty(
			'--selected-grid-border',
			themeJSON ? themeJSON.selectedGridBorder : defaultThemeJSON[theme]?.selectedGridBorder
		);
		document.body.style.setProperty(
			'--selected-grid-background',
			themeJSON ? themeJSON.selectedGridBackground : defaultThemeJSON[theme]?.selectedGridBackground
		);
		document.body.style.setProperty(
			'--selected-grid-color',
			themeJSON ? themeJSON.selectedGridColor : defaultThemeJSON[theme]?.selectedGridColor
		);

		changeElementTheme(document.querySelector('.loading-bar'), 'loadingBar', 'background', theme);
		changeElementTheme(document.querySelector('.loader'), 'loader', 'background', theme);

		changeElementTheme(document.querySelector('.topbar'), 'topbarBackground', 'background', theme);
		changeElementTheme(document.querySelector('.sidebar'), 'sidebarBackground', 'background', theme);
		changeElementTheme(document.querySelector('.sidebar-setting-btn'), 'settingButtonBackground', 'background', theme);
		changeElementTheme(document.querySelector('.sidebar-setting-btn'), 'settingButtonColor', 'color', theme);

		document.querySelectorAll<HTMLElement>('.sidebar-hover-effect').forEach((obj) => {
			obj.style.borderRadius = '6px';
			changeElementTheme(obj, 'sidebarBackground', 'background', theme);
			if (obj.getAttribute('being-listened') !== 'true') {
				obj.setAttribute('being-listened', 'true');
				obj.addEventListener('mousemove', (e) => {
					const rect = (e.target as Element).getBoundingClientRect();
					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					const elementIsActive = obj.classList.contains('active');
					if (elementIsActive) obj.onmouseleave = null;
					else {
						obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle(
							'sidebarHoverEffectBackground',
							currentTheme
						)} )`;
						obj.onmouseleave = () => {
							obj.style.background = getElementStyle('sidebarBackground', currentTheme);
							obj.style.borderImage = null;
						};
					}
				});
			}
		});
	}
	if (category === '*' || category === 'windowmanager') {
		changeElementTheme(document.querySelector('#minimize'), 'minimizeBackground', 'background', theme);
		changeElementTheme(document.querySelector('#minimize'), 'minimizeColor', 'color', theme);
		changeElementTheme(document.querySelector('#maximize'), 'maximizeBackground', 'background', theme);
		changeElementTheme(document.querySelector('#maximize'), 'maximizeColor', 'color', theme);
		changeElementTheme(document.querySelector('#exit'), 'exitBackground', 'background', theme);
		changeElementTheme(document.querySelector('#exit'), 'exitColor', 'color', theme);
		changeElementTheme(document.querySelector('.create-new-tab'), 'newTabBackground', 'background', theme);
		changeElementTheme(document.querySelector('.create-new-tab'), 'newTabColor', 'color', theme);
		changeElementTheme(document.querySelector('#go-back'), 'navigatorBackground', 'background', theme);
		changeElementTheme(document.querySelector('#go-back'), 'navigatorColor', 'color', theme);
		changeElementTheme(document.querySelector('#go-forward'), 'navigatorBackground', 'background', theme);
		changeElementTheme(document.querySelector('#go-forward'), 'navigatorColor', 'color', theme);
		changeElementTheme(document.querySelector('#refresh'), 'navigatorBackground', 'background', theme);
		changeElementTheme(document.querySelector('#refresh'), 'navigatorColor', 'color', theme);
	}
	if (category === '*' || category === 'tabbing') {
		changeElementTheme(document.querySelector('.path-navigator'), 'pathNavigatorBackground', 'background', theme);
		changeElementTheme(document.querySelector('.path-navigator'), 'pathNavigatorColor', 'color', theme);
		changeElementTheme(document.querySelector('.search-bar'), 'searchBarBackground', 'background', theme);
		changeElementTheme(document.querySelector('.search-bar'), 'searchBarColor', 'color', theme);
		document
			.querySelector<HTMLElement>('.tabs-manager')
			.style.setProperty('--tabs-scrollbar-track', themeJSON ? themeJSON.tabsScrollbarTrack : defaultThemeJSON[theme]?.tabsScrollbarTrack);
		document
			.querySelector<HTMLElement>('.tabs-manager')
			.style.setProperty('--tabs-scrollbar-thumb', themeJSON ? themeJSON.tabsScrollbarThumb : defaultThemeJSON[theme]?.tabsScrollbarThumb);
		document
			.querySelector<HTMLElement>('.tabs-manager')
			.style.setProperty(
				'--tabs-scrollbar-thumb-hover',
				themeJSON ? themeJSON.tabsScrollbarThumbHover : defaultThemeJSON[theme]?.tabsScrollbarThumbHover
			);
		document.querySelectorAll<HTMLElement>('.tab').forEach((tab) => {
			changeElementTheme(tab, 'tabBackground', 'background', theme);
			changeElementTheme(tab, 'tabColor', 'color', theme);
		});
		document.querySelectorAll<HTMLElement>('.tab-hover-effect').forEach((obj) => {
			changeElementTheme(obj, 'tabBackground', 'background', theme);
			if (obj.getAttribute('being-listened') !== 'true') {
				obj.setAttribute('being-listened', 'true');
				obj.addEventListener('mousemove', (e) => {
					const rect = (e.target as Element).getBoundingClientRect();
					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle('tabHoverEffectBackground', currentTheme)} )`;
					obj.onmouseleave = () => {
						obj.style.background = getElementStyle('tabBackground', currentTheme);
						obj.style.borderImage = null;
					};
				});
			}
		});
	}
	if (category === '*' || category === 'settings') {
		changeElementTheme(document.querySelector('.settings-sidebar'), 'settingsSidebarBackground', 'background', theme);
		changeElementTheme(document.querySelector('.settings-main'), 'settingsMainBackground', 'background', theme);
		changeElementTheme(document.querySelector('.active'), 'settingsActiveTab', 'background', theme);
		changeElementTheme(document.querySelector('.number-ctrl-minus'), 'settingsNumberCtrlControllerBackground', 'background', theme);
		changeElementTheme(document.querySelector('.number-ctrl-plus'), 'settingsNumberCtrlControllerBackground', 'background', theme);
		changeElementTheme(document.querySelector('.number-ctrl-input'), 'settingsNumberCtrlInputBackground', 'background', theme);
		changeElementTheme(document.querySelector('.number-ctrl-minus'), 'settingsNumberCtrlControllerColor', 'color', theme);
		changeElementTheme(document.querySelector('.number-ctrl-plus'), 'settingsNumberCtrlControllerColor', 'color', theme);
		changeElementTheme(document.querySelector('.number-ctrl-input'), 'settingsNumberCtrlInputColor', 'color', theme);
	}
	if (category === '*' || category === 'contextmenu') {
		changeElementTheme(document.querySelector('.contextmenu'), 'contextMenuBackground', 'background', theme);
		changeElementTheme(document.querySelector('.contextmenu'), 'contextMenuColor', 'color', theme);
		document.querySelectorAll<HTMLElement>('.contextmenu-submenu').forEach((submenu) => {
			changeElementTheme(submenu, 'contextMenuSubmenuBackground', 'background', theme);
			changeElementTheme(submenu, 'contextMenuSubmenuColor', 'color', theme);
		});
	}
	if (category === '*' || category === 'preview') {
		changeElementTheme(document.querySelector('.preview'), 'previewFileBackground', 'background', theme);
		changeElementTheme(document.querySelector('.preview'), 'previewFileColor', 'color', theme);
		changeElementTheme(document.querySelector('.preview-exit-btn'), 'previewExitButtonBackground', 'background', theme);
		changeElementTheme(document.querySelector('.preview-exit-btn'), 'previewExitButtonColor', 'color', theme);
		changeElementTheme(document.querySelector('.preview-object'), 'previewObjectBackground', 'background', theme);
		changeElementTheme(document.querySelector('.preview-object'), 'previewObjectColor', 'color', theme);
		document
			.querySelector<HTMLElement>('.preview-object')
			?.style?.setProperty(
				'--preview-object-table-border',
				themeJSON ? themeJSON.previewObjectTableBorder : defaultThemeJSON[theme].previewObjectTableBorder
			);
		document
			.querySelector<HTMLElement>('.preview-object')
			?.style?.setProperty(
				'--preview-object-table-row-even-bg',
				themeJSON ? themeJSON.previewObjectTableRowEvenBackground : defaultThemeJSON[theme].previewObjectTableRowEvenBackground
			);
		document
			.querySelector<HTMLElement>('.preview-object')
			?.style?.setProperty(
				'--preview-object-table-row-even-color',
				themeJSON ? themeJSON.previewObjectTableRowEvenColor : defaultThemeJSON[theme].previewObjectTableRowEvenColor
			);
		document
			.querySelector<HTMLElement>('.preview-object')
			?.style?.setProperty(
				'--preview-object-table-row-odd-bg',
				themeJSON ? themeJSON.previewObjectTableRowOddBackground : defaultThemeJSON[theme].previewObjectTableRowOddBackground
			);
		document
			.querySelector<HTMLElement>('.preview-object')
			?.style?.setProperty(
				'--preview-object-table-row-odd-color',
				themeJSON ? themeJSON.previewObjectTableRowOddColor : defaultThemeJSON[theme].previewObjectTableRowOddColor
			);
		document
			.querySelector<HTMLElement>('.preview-object')
			?.setAttribute('data-theme-category', themeJSON ? themeJSON.themeCategory : defaultThemeJSON[theme].themeCategory);
	}
	if (category === '*' || category === 'properties') {
		changeElementTheme(document.querySelector('.properties'), 'propertiesBackground', 'background', theme);
	}
	if (category === '*' || category === 'prompt') {
		changeElementTheme(document.querySelector('.prompt'), 'promptBackground', 'background', theme);
		changeElementTheme(document.querySelector('.prompt-input'), 'promptInputColor', 'color', theme);
		changeElementTheme(document.querySelector('.prompt-input'), 'promptInputBackground', 'background', theme);
		changeElementTheme(document.querySelector('.prompt-exit-btn'), 'exitBackground', 'background', theme);
		changeElementTheme(document.querySelector('.prompt-exit-btn'), 'exitColor', 'color', theme);
		changeElementTheme(document.querySelector('.prompt-ok'), 'promptOkColor', 'color', theme);
		changeElementTheme(document.querySelector('.prompt-ok'), 'promptOkBackground', 'background', theme);
	}
	if (category === '*' || category === 'favorites') {
		document.querySelectorAll<HTMLElement>('.favorite').forEach((favorite) => {
			changeElementTheme(favorite, 'favoriteBackground', 'background', theme);
			changeElementTheme(favorite, 'favoriteColor', 'color', theme);
		});
		document.querySelectorAll<HTMLElement>('.pendrive').forEach((pendrive) => {
			changeElementTheme(pendrive, 'pendriveBackground', 'background', theme);
			changeElementTheme(pendrive, 'pendriveColor', 'color', theme);
		});
		document.querySelectorAll<HTMLElement>('.pendrive-total-capacity').forEach((bar) => {
			changeElementTheme(bar, 'pendriveTotalCapacityBackground', 'background', theme);
		});
		document.querySelectorAll<HTMLElement>('.pendrive-used-capacity').forEach((bar) => {
			changeElementTheme(bar, 'pendriveUsedCapacityBackground', 'background', theme);
		});
		document.querySelectorAll<HTMLElement>('.card-hover-effect').forEach((obj) => {
			if (obj.getAttribute('being-listened') !== 'true') {
				obj.setAttribute('being-listened', 'true');
				obj.addEventListener('mousemove', (e) => {
					const { x, y } = getXYCoordinates(e);

					obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle('cardHoverEffectBackground', currentTheme)} )`;
					obj.onmouseleave = () => {
						obj.style.background = null;
						obj.style.borderImage = null;
					};
				});
			}
		});
	}
	if (category === '*' || category === 'grid') {
		document.querySelectorAll<HTMLElement>('.grid-hover-effect').forEach((obj) => {
			changeElementTheme(obj, 'gridBackground', 'background', null);
			if (obj.getAttribute('being-listened') !== 'true') {
				obj.setAttribute('being-listened', 'true');
				obj.addEventListener('mousemove', (e) => {
					const { x, y } = getXYCoordinates(e);

					obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle('gridHoverEffectBackground', currentTheme)} )`;
					obj.onmouseleave = () => {
						obj.style.background = null;
						obj.style.borderImage = null;
					};
				});
			}
		});
		document.querySelectorAll<HTMLElement>('.file-grid').forEach((grid) => {
			changeElementTheme(grid, 'gridBackground', 'background', theme);
			changeElementTheme(grid, 'gridColor', 'color', theme);
		});
	}
	if (category === '*' || category === 'infobar') {
		changeElementTheme(document.querySelector('.infobar'), 'infobarBackground', 'background', theme);
		changeElementTheme(document.querySelector('.infobar'), 'infobarColor', 'color', theme);
	}

	return;
};

/**
 * Update the entire page theme
 * @returns {Promise<void>}
 */
const updateTheme = async (
	category?:
		| '*'
		| 'root'
		| 'windowmanager'
		| 'tabbing'
		| 'settings'
		| 'favorites'
		| 'grid'
		| 'contextmenu'
		| 'prompt'
		| 'preview'
		| 'properties'
		| 'infobar'
): Promise<void> => {
	const data: themeData = await Storage.get('theme');
	// If user has no preference theme
	if (!data || !Object.keys(data).length) {
		currentTheme = defaultTheme;
		await changeTheme(defaultTheme, category);
	} else {
		// If user preference is default color theme...
		if (Object.keys(defaultThemeJSON).indexOf(data.theme) !== -1) {
			currentTheme = data.theme;
			await changeTheme(data.theme, category);
		} else {
			currentTheme = defaultTheme;
			await changeTheme(defaultTheme, category);
		}
	}
	return;
};

export { changeTheme, updateTheme, detectDefaultTheme, updateNativeTheme, getElementStyle };
