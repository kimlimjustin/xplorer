import IStorageData from '../../Typings/storageData';
import Storage from '../../Service/storage';

const sidebarEdgeSensor = 10;
const windowMinSize = 800;

let sidebarMinSize: number;
let sidebarMinSnap: number;
let sidebarDefaultExpandedSize: number;

let sidebar: HTMLElement;
let settingsSidebar: HTMLElement;
let appearance: IStorageData;

export const updateSidebarParameters = (updateSidebar = false) => {
	const fontSize = parseInt(document.documentElement.style.fontSize || '18');
	const sidebarDefaultExpandedSizeOld = sidebarDefaultExpandedSize;
	const sidebarMinSizeOld = sidebarMinSize;
	sidebarMinSize = fontSize * 4;
	sidebarMinSnap = 180 + fontSize * 4;
	sidebarDefaultExpandedSize = 200 + fontSize * 4;
	if (!updateSidebar) return;

	let size = parseInt(appearance.expandedSidebarWidth);
	if (sidebar.offsetWidth !== sidebarMinSizeOld) size = sidebar.offsetWidth;
	else size ||= sidebarDefaultExpandedSizeOld;
	size = (size / sidebarDefaultExpandedSizeOld) * sidebarDefaultExpandedSize;

	const minimized = size < sidebarMinSnap || appearance.preferMinimizedSidebar;
	resizeSidebar((minimized ? sidebarMinSize : size) + 'px');
	appearance.expandedSidebarWidth = Math.max(size, sidebarMinSnap) + 'px';
	Storage.set('appearance', appearance);
};

export const resizeSidebar = function (size?: string) {
	if (!size) {
		if (sidebar.offsetWidth === sidebarMinSize) {
			const defaultSidebarWidth = sidebarDefaultExpandedSize + 'px';
			size = appearance.expandedSidebarWidth || defaultSidebarWidth;
			appearance.preferMinimizedSidebar = false;
		} else {
			size = sidebarMinSize + 'px';
			appearance.preferMinimizedSidebar = true;
		}
		Storage.set('appearance', appearance);
	}
	const root = document.documentElement;
	if (size === sidebarMinSize + 'px') {
		sidebar.classList.add('sidebar-minimized');
		settingsSidebar.classList.add('sidebar-minimized');
		root.style.setProperty('--sidebar-minimized-width', size);
	} else {
		sidebar.classList.remove('sidebar-minimized');
		settingsSidebar.classList.remove('sidebar-minimized');
		root.style.setProperty('--sidebar-minimized-width', '0px');
	}
	appearance.sidebarWidth = size;
	if (sidebar.animate && !matchMedia('(prefers-reduced-motion)').matches) {
		const animateOptions = { duration: 100, fill: 'forwards' } as const;
		sidebar.animate({ width: size }, animateOptions);
		settingsSidebar.animate({ width: size }, animateOptions);
	} else sidebar.style.width = settingsSidebar.style.width = size;
};

export const Resizer = async (): Promise<void> => {
	sidebar = document.querySelector<HTMLElement>('.sidebar');
	settingsSidebar = document.querySelector<HTMLElement>('.settings-sidebar');
	appearance = (await Storage.get('appearance')) || {};
	updateSidebarParameters();
	const defaultSidebarWidth = sidebarDefaultExpandedSize + 'px';
	resizeSidebar(appearance.sidebarWidth || defaultSidebarWidth);

	const resizeWindow = () => {
		if (window.innerWidth < windowMinSize) resizeSidebar(sidebarMinSize + 'px');
		else if (!appearance.preferMinimizedSidebar) {
			resizeSidebar(appearance.expandedSidebarWidth || defaultSidebarWidth);
		}
	};
	resizeWindow();
	window.addEventListener('resize', resizeWindow);

	let resizing = false;

	document.addEventListener('mouseup', () => (resizing = false));

	document.addEventListener('mousedown', ({ clientX: mx }) => {
		const { offsetWidth: w } = sidebar;
		resizing = Math.abs(w - mx) < sidebarEdgeSensor;
	});

	document.addEventListener('mousemove', (event) => {
		type MouseMoveEvent = MouseEvent & { target: HTMLElement };
		const { clientX: mx, clientY: my, target } = event as MouseMoveEvent;
		if (resizing) {
			let width = mx + 'px';
			if (mx < sidebarMinSnap) {
				width = sidebarMinSize + 'px';
				appearance.preferMinimizedSidebar = true;
			} else {
				appearance.expandedSidebarWidth = width;
				appearance.preferMinimizedSidebar = false;
			}
			resizeSidebar(width);
			Storage.set('appearance', appearance);
		}
		if (sidebar.classList.contains('sidebar-minimized')) {
			const itemClasses = ['favorite-item', 'drive-item'];
			if (itemClasses.some((c) => target.classList.contains(c))) {
				const sidebarText = target.querySelector<HTMLElement>('.sidebar-text');
				const { offsetTop: y, offsetHeight: h } = sidebarText;
				const root = document.documentElement;
				root.style.setProperty('--sidebar-text-y', my - y - h / 2 + 'px');
			}
		}
		const { offsetWidth: w } = sidebar;
		if (Math.abs(w - mx) < sidebarEdgeSensor || resizing) {
			document.body.classList.add('resize-horizontal');
		} else {
			document.body.classList.remove('resize-horizontal');
		}
	});
};
