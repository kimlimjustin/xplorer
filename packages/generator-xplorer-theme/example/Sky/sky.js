'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true,
});

const Theme = () => {
	const ALICE_BLUE = '#DCEDFF';
	const LIGHT_STEEL_BLUE = '#AFC7EA';
	const POWDER_BLUE = '#BFEAEA';
	return {
		themeCategory: 'dark',
		textColor: '#000',
		fontSize: '18px',
		fontFamily: 'system-ui',
		scrollbarTrackBackground: 'rgb(185, 185, 185)',
		scrollbarThumbBackground: 'rgb(163, 163, 163)',
		scrollbarThumbHoverBackground: '#888',

		sidebarBackground: ALICE_BLUE,
		mainBackground: LIGHT_STEEL_BLUE,
		topbarBackground: ALICE_BLUE,

		minimizeBackground: '#fbd914',
		minimizeColor: '#14141b',
		maximizeBackground: '#00ca4e',
		maximizeColor: '#14141b',
		exitBackground: '#ff4743',
		exitColor: '#14141b',

		loadingBar: '#cbccd1',
		loader: '#6d94a2',

		tabBackground: POWDER_BLUE,
		tabColor: '#000 ',
		newTabBackground: '#cce0ef',
		newTabColor: '#000',
		navigatorBackground: 'transparent',
		navigatorColor: '#000',
		pathNavigatorBackground: POWDER_BLUE,
		pathNavigatorColor: '#000',
		menuDropdownBackground: POWDER_BLUE,
		menuDropdownColor: '#000',

		settingsSidebarBackground: ALICE_BLUE,
		settingsMainBackground: LIGHT_STEEL_BLUE,
		settingButtonBackground: 'inherit',
		settingButtonColor: 'inherit',

		tabsScrollbarTrack: 'rgb(185, 185, 185)',
		tabsScrollbarThumb: 'rgb(163, 163, 163)',
		tabsScrollbarThumbHover: '#888',

		favoriteBackground: ALICE_BLUE,
		favoriteHoverBackground: '#c5ccd2',
		favoriteColor: '#000',
		pendriveBackground: ALICE_BLUE,
		pendriveHoverBackground: '#c5ccd2',
		pendriveColor: '#000',
		pendriveTotalCapacityBackground: '#eee',
		pendriveUsedCapacityBackground: '#8989e2',

		gridBackground: 'transparent',
		gridColor: '#000',
		selectedGridBorder: LIGHT_STEEL_BLUE,
		selectedGridBackground: POWDER_BLUE,
		selectedGridColor: '#000',

		gridHoverEffectBackground: `${POWDER_BLUE},${ALICE_BLUE}`,
		cardHoverEffectBackground: `${POWDER_BLUE},${ALICE_BLUE}`,
		sidebarHoverEffectBackground: `${POWDER_BLUE},${ALICE_BLUE}`,
		tabHoverEffectBackground: `${POWDER_BLUE},${ALICE_BLUE}`,

		contextMenuBackground: ALICE_BLUE,
		contextMenuColor: 'inherit',
		contextMenuSubmenuBackground: POWDER_BLUE,
		contextMenuSubmenuColor: 'inherit',

		previewFileBackground: POWDER_BLUE,
		previewFileColor: '#000',
		previewExitButtonBackground: 'rgb(226, 227, 232)',
		previewExitButtonColor: '#000',
		previewObjectBackground: POWDER_BLUE,
		previewObjectColor: 'inherit',
		previewObjectTableBorder: '1px solid #ddd',
		previewObjectTableRowEvenBackground: '#ddd',
		previewObjectTableRowEvenColor: 'inherit',
		previewObjectTableRowOddBackground: 'inherit',
		previewObjectTableRowOddColor: 'inherit',

		propertiesBackground: ALICE_BLUE,

		acrylicEffect: [],
	};
};
exports.default = Theme;
