import { listenStylesheetChange } from '../../Api/app';
import Storage from '../../Api/storage';
import { CustomTheme, Theme } from '../../Typings/theme';
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

const ALLOWED_STYLES = [
	'background',
	'color',
	'font',
	'border',
	'text',
	'cursor',
	'outline',
	'--scrollbar',
	'--tabs-scrollbar',
	'--preview-object',
	'--selected-grid',
];

/**
 * Change page theme
 * @param {string} theme - The current theme
 * @returns {Promise<void>}
 */
const changeTheme = async (theme?: string, category?: '*' | 'root' | 'tabbing' | 'favorites' | 'grid'): Promise<void> => {
	if (!category) category = '*';
	const appearance = await Storage.get('appearance');
	if (category === '*' || category === 'root') {
		1;
		document.body.style.setProperty('--edge-radius', appearance?.frameStyle === 'os' ? '0px' : '10px');
		document.body.style.fontSize = appearance?.fontSize ?? '16px';
		document.documentElement.style.fontSize = appearance?.fontSize ?? '16px';
		document.body.style.fontFamily = appearance?.fontFamily ?? 'system-ui';
		document.documentElement.style.fontFamily = appearance?.fontFamily ?? 'system-ui';
		document.body.style.setProperty(
			'--sidebar-transparency',
			appearance?.transparentSidebar ?? true ? appearance?.windowTransparency ?? '0.8' : '1'
		);
		document.body.style.setProperty(
			'--workspace-transparency',
			appearance?.transparentWorkspace ?? false ? appearance?.windowTransparency ?? '0.8' : '1'
		);
		document.body.style.setProperty(
			'--topbar-transparency',
			appearance?.transparentTopbar ?? false ? appearance?.windowTransparency ?? '0.8' : '1'
		);

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
						obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle('animation.sidebar', currentTheme)} )`;
						obj.onmouseleave = () => {
							obj.style.background = null;
							obj.style.borderImage = null;
						};
					}
				});
			}
		});

		const style = document.querySelector('style#root') ?? document.createElement('style');
		style.id = 'root';
		let styles = '';

		// Generate CSS styles from user theme
		for (const key of Object.keys(themeJSON ?? defaultThemeJSON[theme])) {
			const value = themeJSON ? themeJSON[key] : defaultThemeJSON[theme]?.[key];
			const formalKey = key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
			const styleKey = formalKey.split('.').at(-1);
			if (key.startsWith('hljs')) {
				const className = formalKey.split('.').slice(0, -1).join('.').replace('hljs.', 'hljs-');
				styles += `.${className} { ${styleKey}: ${value}; }\n`;
			} else {
				for (const _category of [
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
				]) {
					if (key.startsWith(_category)) {
						const usingClassName = formalKey[_category.length] === '.';
						const className = formalKey.split('.').slice(1, -1).join('.');
						const idName = formalKey.split('#').slice(1).join('#').split('.')[0];
						for (const allowed_style of ALLOWED_STYLES) {
							if (styleKey.startsWith(allowed_style)) {
								if (styleKey.startsWith('--')) {
									styles += `:root { ${styleKey}: ${value}; }\n`;
								} else {
									styles += `${
										usingClassName
											? className === ''
												? _category === 'root'
													? ':root'
													: '.' + _category
												: '.' + className
											: '#' + idName
									}{ ${styleKey}: ${value}; }\n`;
								}
								break;
							}
						}
					}
				}
			}
		}
		style.innerHTML = styles;
		if (!document.head.contains(style)) document.head.appendChild(style);
	}
	if (category === '*' || category === 'tabbing') {
		document.querySelectorAll<HTMLElement>('.tab-hover-effect').forEach((obj) => {
			changeElementTheme(obj, 'tabBackground', 'background', theme);
			if (obj.getAttribute('being-listened') !== 'true') {
				obj.setAttribute('being-listened', 'true');
				obj.addEventListener('mousemove', (e) => {
					const rect = (e.target as Element).getBoundingClientRect();
					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle('animation.tab', currentTheme)} )`;
					obj.onmouseleave = () => {
						obj.style.background = null;
						obj.style.borderImage = null;
					};
				});
			}
		});
	}
	if (category === '*' || category === 'favorites') {
		document.querySelectorAll<HTMLElement>('.card-hover-effect').forEach((obj) => {
			if (obj.getAttribute('being-listened') !== 'true') {
				obj.setAttribute('being-listened', 'true');
				obj.addEventListener('mousemove', (e) => {
					const { x, y } = getXYCoordinates(e);

					obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle('animation.card', currentTheme)} )`;
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

					obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle('animation.grid', currentTheme)} )`;
					obj.onmouseleave = () => {
						obj.style.background = null;
						obj.style.borderImage = null;
					};
				});
			}
		});
	}

	return;
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
		for (const theme of extension.themes) {
			themes.push({
				name: theme.name,
				identifier: extension.identifier + '@' + theme.identifier,
				author: extension.author,
				version: extension.version,
				description: extension.description,
				homepage: extension.homepage,
				repository: extension.repository,
				license: extension.license,
				theme: theme.value,
			});
		}
	}
	return themes;
};

/**
 * Update the entire page theme
 * @returns {Promise<void>}
 */
const updateTheme = async (category?: '*' | 'root' | 'tabbing' | 'favorites' | 'grid', customStyleSheet?: JSON): Promise<void> => {
	const data = await Storage.get('theme');
	if (customStyleSheet) {
		themeJSON = customStyleSheet as unknown as Theme;
		document.body.dataset.usingCustomTheme = 'true';
		listenStylesheetChange((styles) => {
			themeJSON = styles as unknown as Theme;
			changeTheme(data.theme, '*');
		});
	}
	// If user has no preference theme
	if (!data || !Object.keys(data).length || data.theme === 'System Default') {
		currentTheme = defaultTheme;
		await changeTheme(defaultTheme, category);
	} else {
		// If user preference is default color theme...
		if (Object.keys(defaultThemeJSON).indexOf(data.theme) !== -1) {
			if (document.body.dataset.usingCustomTheme !== 'true') themeJSON = null;
			currentTheme = data.theme;
			await changeTheme(data.theme, category);
		} else {
			for (const theme of await getInstalledThemes()) {
				if (theme.identifier === data.theme) {
					if (document.body.dataset.usingCustomTheme !== 'true') themeJSON = theme.theme;
					await changeTheme(theme.name, category);
					break;
				}
			}
		}
	}
	return;
};

export { changeTheme, updateTheme, detectDefaultTheme, updateNativeTheme, getElementStyle, getInstalledThemes };
