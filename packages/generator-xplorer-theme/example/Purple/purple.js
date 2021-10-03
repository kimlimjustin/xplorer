'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true,
});

const Theme = () => {
	const MEDIUM_PURPLE = '#9381FF';
	const MAXIMUM_BLUE_PURPLE = '#B8B8FF';
	const GHOST_WHITE = '#F8F7FF';
	const ANTIQUE_WHITE = '#FFEEDD';
	const UNBLEACHED_SILK = '#FFD8BE';

	return {
		themeCategory: 'dark',
		textColor: '#000',
		fontSize: '18px',
		fontFamily: 'system-ui',
		scrollbarTrackBackground: 'rgb(185, 185, 185)',
		scrollbarThumbBackground: 'rgb(163, 163, 163)',
		scrollbarThumbHoverBackground: '#888',

		sidebarBackground: MAXIMUM_BLUE_PURPLE,
		mainBackground: MEDIUM_PURPLE,
		topbarBackground: MAXIMUM_BLUE_PURPLE,

		minimizeBackground: '#fbd914',
		minimizeColor: '#14141b',
		maximizeBackground: '#00ca4e',
		maximizeColor: '#14141b',
		exitBackground: '#ff4743',
		exitColor: '#14141b',

		loadingBar: '#cbccd1',
		loader: '#6d94a2',

		tabBackground: GHOST_WHITE,
		tabColor: '#000 ',
		newTabBackground: GHOST_WHITE,
		newTabColor: '#000',
		navigatorBackground: 'transparent',
		navigatorColor: '#000',
		pathNavigatorBackground: GHOST_WHITE,
		pathNavigatorColor: '#000',
		menuDropdownBackground: GHOST_WHITE,
		menuDropdownColor: '#000',

		settingsSidebarBackground: MAXIMUM_BLUE_PURPLE,
		settingsMainBackground: MEDIUM_PURPLE,
		settingButtonBackground: 'inherit',
		settingButtonColor: 'inherit',

		tabsScrollbarTrack: 'rgb(185, 185, 185)',
		tabsScrollbarThumb: 'rgb(163, 163, 163)',
		tabsScrollbarThumbHover: '#888',

		favoriteBackground: GHOST_WHITE,
		favoriteHoverBackground: '#c5ccd2',
		favoriteColor: '#000',
		pendriveBackground: GHOST_WHITE,
		pendriveHoverBackground: '#c5ccd2',
		pendriveColor: '#000',
		pendriveTotalCapacityBackground: '#eee',
		pendriveUsedCapacityBackground: '#8989e2',

		gridBackground: 'transparent',
		gridColor: '#000',
		selectedGridBorder: 'none',
		selectedGridBackground: MAXIMUM_BLUE_PURPLE,
		selectedGridColor: '#000',

		gridHoverEffectBackground: `${ANTIQUE_WHITE},${UNBLEACHED_SILK}`,
		cardHoverEffectBackground: `${ANTIQUE_WHITE},${UNBLEACHED_SILK}`,
		sidebarHoverEffectBackground: `${ANTIQUE_WHITE},${UNBLEACHED_SILK}`,
		tabHoverEffectBackground: `${ANTIQUE_WHITE},${UNBLEACHED_SILK}`,

		contextMenuBackground: MAXIMUM_BLUE_PURPLE,
		contextMenuColor: 'inherit',
		contextMenuSubmenuBackground: MAXIMUM_BLUE_PURPLE,
		contextMenuSubmenuColor: 'inherit',

		previewFileBackground: MAXIMUM_BLUE_PURPLE,
		previewFileColor: '#000',
		previewExitButtonBackground: 'rgb(226, 227, 232)',
		previewExitButtonColor: '#000',
		previewObjectBackground: '#c3c3c3',
		previewObjectColor: 'inherit',
		previewObjectTableBorder: '1px solid #ddd',
		previewObjectTableRowEvenBackground: '#ddd',
		previewObjectTableRowEvenColor: 'inherit',
		previewObjectTableRowOddBackground: 'inherit',
		previewObjectTableRowOddColor: 'inherit',

		propertiesBackground: '#e0e0e0',

		acrylicEffect: [],
	};
};
exports.default = Theme;
