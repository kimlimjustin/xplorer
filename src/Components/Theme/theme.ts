import isTauri from '../../Util/is-tauri';
import { listenStylesheetChange } from '../../Service/app';
import Storage from '../../Service/storage';
import { CustomTheme, Theme } from '../../Typings/theme';

type Category = '*' | 'root' | 'tabbing' | 'favorites' | 'grid';
type ElementType = 'sidebar' | 'tab' | 'card' | 'grid';

import IsValid from '../Functions/validChecker';
/**
 * Detect system theme
 * @returns {string} System color scheme preference
 */
const detectDefaultTheme = (): string => {
	if (matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
	return 'light';
};

let defaultTheme = detectDefaultTheme();
const updateNativeTheme = (): void => {
	defaultTheme = detectDefaultTheme();
	updateTheme('*');
};

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
	defaultTheme = e.matches ? 'dark' : 'light';
	updateTheme('*');
});

let themeJSON: Theme; // user preference theme json
import * as defaultThemeData from './theme.json';
interface DefaultTheme {
	[key: string]: Theme;
}
const defaultThemeJSON: DefaultTheme = defaultThemeData;

let currentTheme: string;

/**
 * Get style of an element
 * @param {string} variable - What style you wanna get?
 * @param {string} theme - The current theme
 * @returns {string|null} Style of the [variable] of the element
 */
const getElementStyle = (variable: string, theme?: string): string | null => {
	return themeJSON?.[variable] || defaultThemeJSON[theme ?? currentTheme]?.[variable];
};

/**
 * Change style of an element
 * @param {HTMLElement} element - Element you want to change the theme style
 * @param {string} variable - The style you wanna change
 * @param {any} key - CSS key of the style
 * @param {string} theme - Current theme
 * @returns {void}
 */
const changeElementTheme = (element: HTMLElement, variable: string, key: string, theme: string) => {
	if (element) (<any>element.style)[key] = themeJSON?.[variable] || defaultThemeJSON?.[theme]?.[variable]; //eslint-disable-line
};

/**
 * Return the hover handler for an element
 * @param {HTMLElement} obj - Element to add the hover handler
 * @param {string} theme - The current theme
 * @param {any} type - Type of element
 * @returns {void}
 */
const hoverHandler = (obj: HTMLElement, theme: string, type: ElementType) => {
	changeElementTheme(obj, type + 'Background', 'background', theme);
	if (obj.getAttribute('being-listened') === 'true') return;
	obj.setAttribute('being-listened', 'true');
	obj.addEventListener('mousemove', (e) => {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		if (obj.classList.contains('active')) return (obj.onmouseleave = null);
		const color = getElementStyle('animation.' + type, currentTheme);
		obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${color})`;
		obj.onmouseleave = () => (obj.style.background = obj.style.borderImage = null);
	});
};

const ALLOWED_STYLES = [
	'background',
	'color',
	'font',
	'border',
	'text',
	'cursor',
	'outline',
	'box-shadow',
	'--scrollbar',
	'--tabs-scrollbar',
	'--preview-object',
	'--selected-grid',
];

// prettier-ignore
const CATEGORIES = [
	'root',
	'windowmanager',
	'tabs',
	'settings',
	'favorites',
	'grid',
	'contextmenu',
	'prompt',
	'preview',
	'properties',
];

/**
 * Change page theme
 * @param {string} theme - The current theme
 * @returns {Promise<void>}
 */
const changeTheme = async (theme?: string, category?: Category): Promise<void> => {
	if (!category) category = '*';
	const appearance = (await Storage.get('appearance')) || {};
	if (category === '*' || category === 'root') {
		const root = document.documentElement;
		const opacity = appearance.windowTransparency || '0.8';
		root.style.fontSize = appearance.fontSize || '16px';
		root.style.fontFamily = appearance.fontFamily || 'system-ui';
		root.style.setProperty('--edge-radius', appearance.frameStyle === 'os' || !isTauri ? '0px' : '10px');
		root.style.setProperty('--sidebar-transparency', isTauri && (appearance.transparentSidebar ?? true) ? opacity : 1);
		root.style.setProperty('--workspace-transparency', isTauri && appearance.transparentWorkspace ? opacity : 1);
		root.style.setProperty('--topbar-transparency', isTauri && appearance.transparentTopbar ? opacity : 1);

		const sidebarItems = document.querySelectorAll<HTMLElement>('.sidebar-hover-effect');
		sidebarItems.forEach((obj) => hoverHandler(obj, theme, 'sidebar'));

		const style = document.querySelector('style#root') ?? document.createElement('style');
		style.id = 'root';
		let content = '';
		// Generate CSS styles from user theme
		for (const key of Object.keys(IsValid(themeJSON) ? themeJSON : defaultThemeJSON[theme])) {
			const value = IsValid(themeJSON) ? themeJSON[key] : defaultThemeJSON[theme]?.[key];
			const formalKey = key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
			const splittedKey = formalKey.split('.');
			const styleKey = splittedKey[splittedKey.length - 1];
			if (key.startsWith('hljs')) {
				const className = formalKey.split('.').slice(0, -1).join('.').replace('hljs.', 'hljs-');
				content += `.${className} { ${styleKey}: ${value} }\n`;
			} else {
				for (const _category of CATEGORIES) {
					if (!key.startsWith(_category)) continue;
					const usingClassName = formalKey[_category.length] === '.';
					const className = formalKey.split('.').slice(1, -1).join('.');
					const idName = formalKey.split('#').slice(1).join('#').split('.')[0];
					for (const allowedStyle of ALLOWED_STYLES) {
						if (!styleKey.startsWith(allowedStyle)) continue;
						if (styleKey.startsWith('--')) {
							content += `:root { ${styleKey}: ${value}; }\n`;
							break;
						}
						if (!usingClassName) content += '#' + idName;
						else if (className !== '') content += '.' + className;
						else if (_category !== 'root') content += '.' + _category;
						else content += ':root';
						content += `{ ${styleKey}: ${value} }\n`;
						break;
					}
				}
			}
		}
		style.textContent = content;
		!document.head.contains(style) && document.head.appendChild(style);
	}
	if (category === '*' || category === 'tabbing') {
		const tabItems = document.querySelectorAll<HTMLElement>('.tab-hover-effect');
		tabItems.forEach((obj) => hoverHandler(obj, theme, 'tab'));
	}
	if (category === '*' || category === 'favorites') {
		const cardItems = document.querySelectorAll<HTMLElement>('.card-hover-effect');
		cardItems.forEach((obj) => hoverHandler(obj, theme, 'card'));
	}
	if (category === '*' || category === 'grid') {
		const gridItems = document.querySelectorAll<HTMLElement>('.grid-hover-effect');
		gridItems.forEach((obj) => hoverHandler(obj, theme, 'grid'));
	}
};

/**
 * Get all installed themes
 * @returns {Promise<CustomTheme[]>}
 */
const getInstalledThemes = async (): Promise<CustomTheme[]> => {
	const extensions = await Storage.get('extensions');
	const themes: CustomTheme[] = [];
	if (!extensions?.themes) return themes;
	for (const extension of extensions.themes) {
		const { identifier, author, version, description, homepage, repository, license } = extension;
		for (const { name, value } of extension.themes) {
			themes.push({
				name,
				identifier: identifier + '@' + identifier,
				author,
				version,
				description,
				homepage,
				repository,
				license,
				theme: value,
			});
		}
	}
	return themes;
};

/**
 * Update the entire page theme
 * @returns {Promise<void>}
 */
const updateTheme = async (category?: Category, customStyleSheet?: JSON): Promise<void> => {
	const data = await Storage.get('theme');
	if (IsValid(customStyleSheet)) {
		console.log(customStyleSheet);
		themeJSON = customStyleSheet as unknown as Theme;
		document.body.dataset.usingCustomTheme = 'true';
		listenStylesheetChange((styles) => {
			themeJSON = styles as unknown as Theme;
			changeTheme(data.theme, '*');
		});
	}
	// If user has no preference theme
	if (!data || !Object.keys(data).length || data.theme === 'System Default') {
		return await changeTheme((currentTheme = defaultTheme), category);
	}
	// If user preference is default color theme...
	if (Object.keys(defaultThemeJSON).indexOf(data.theme) !== -1) {
		if (document.body.dataset.usingCustomTheme !== 'true') themeJSON = null;
		return await changeTheme((currentTheme = data.theme), category);
	}
	for (const theme of await getInstalledThemes()) {
		if (theme.identifier !== data.theme) continue;
		if (document.body.dataset.usingCustomTheme !== 'true') themeJSON = theme.theme;
		return await changeTheme(theme.name, category);
	}
};

export { changeTheme, updateTheme, detectDefaultTheme, updateNativeTheme, getElementStyle, getInstalledThemes };
