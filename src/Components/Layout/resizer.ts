import Storage from '../../Api/storage';

const SIDEBAR_EDGE_SENSOR = 10;
const SIDEBAR_MIN_SIZE = 70;
const SIDEBAR_MIN_SNAP = 220;
const WINDOW_MIN_SIZE = 800;

let sidebar: HTMLElement;
let settingsSidebar: HTMLElement;
let xplorerBrand: HTMLElement;
let appearance: any;

export const resizeSidebar = function (size?: string) {
	if (!size) {
		if (sidebar.offsetWidth !== SIDEBAR_MIN_SIZE) {
			size = SIDEBAR_MIN_SIZE + 'px';
			appearance.preferMinimizedSidebar = true;
		} else {
			size = appearance.expandedSidebarWidth || '250px';
			appearance.preferMinimizedSidebar = false;
		}
		Storage.set('appearance', appearance);
	}
	if (size === SIDEBAR_MIN_SIZE + 'px') {
		sidebar.classList.add('sidebar-minimized');
		settingsSidebar.classList.add('sidebar-minimized');
		const imgSrc = require('../../Icon/extension/xplorer.svg');
		xplorerBrand.innerHTML = `<img src=${imgSrc} alt="xplorer" />`;
	} else {
		sidebar.classList.remove('sidebar-minimized');
		settingsSidebar.classList.remove('sidebar-minimized');
		xplorerBrand.innerHTML = 'Xplorer';
	}
	appearance.sidebarWidth = size;
	if (sidebar.animate) {
		const animateOptions = { duration: 200, fill: 'forwards' } as const;
		sidebar.animate({ flexBasis: size }, animateOptions);
		settingsSidebar.animate({ flexBasis: size }, animateOptions);
	} else sidebar.style.flexBasis = settingsSidebar.style.flexBasis = size;
};

/**
 * Sidebar resizer initalization
 * @returns {Promise<void>}
 */
export const Resizer = async (): Promise<void> => {
	sidebar = document.querySelector<HTMLElement>('.sidebar');
	settingsSidebar = document.querySelector<HTMLElement>('.settings-sidebar');
	xplorerBrand = document.querySelector<HTMLElement>('.xplorer-brand');
	appearance = (await Storage.get('appearance')) || {};
	resizeSidebar(appearance.sidebarWidth || '250px');

	const resizeWindow = () => {
		if (window.innerWidth < WINDOW_MIN_SIZE) {
			resizeSidebar(SIDEBAR_MIN_SIZE + 'px');
		} else if (!appearance.preferMinimizedSidebar) {
			resizeSidebar(appearance.expandedSidebarWidth || '250px');
		}
	};
	window.addEventListener('resize', resizeWindow);
	resizeWindow();

	let resizing = false;

	document.addEventListener('mouseup', () => (resizing = false));

	document.addEventListener('mousedown', ({ clientX: mx }) => {
		const { offsetWidth: w } = sidebar;
		resizing = Math.abs(w - mx) < SIDEBAR_EDGE_SENSOR;
	});

	document.addEventListener('mousemove', (event) => {
		type MouseMoveEvent = MouseEvent & { target: HTMLElement };
		const { clientX: mx, clientY: my, target } = event as MouseMoveEvent;
		if (resizing) {
			let size = mx + 'px';
			if (mx < SIDEBAR_MIN_SNAP) {
				size = SIDEBAR_MIN_SIZE + 'px';
				appearance.preferMinimizedSidebar = true;
			} else {
				appearance.expandedSidebarWidth = size;
				appearance.preferMinimizedSidebar = false;
			}
			resizeSidebar(size);
			Storage.set('appearance', appearance);
		}
		if (sidebar.classList.contains('sidebar-minimized')) {
			const itemClasses = ['sidebar-item', 'drive-item'];
			if (itemClasses.some((c) => target.classList.contains(c))) {
				const sidebarText = target.querySelector<HTMLElement>('.sidebar-text');
				const { offsetTop: y, offsetHeight: h } = sidebarText;
				const root = document.documentElement;
				root.style.setProperty('--sidebar-text-y', my - y - h / 2 + 'px');
			}
		}
		const { offsetWidth: w } = sidebar;
		if (Math.abs(w - mx) < SIDEBAR_EDGE_SENSOR || resizing) {
			document.body.classList.add('resize-horizontal');
		} else {
			document.body.classList.remove('resize-horizontal');
		}
	});
};
