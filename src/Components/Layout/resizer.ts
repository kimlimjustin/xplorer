import Storage from '../../Api/storage';
/**
 * Sidebar resizer initalization
 * @returns {Promise<void>}
 */
const Resizer = async (): Promise<void> => {
	const sidebarResizer = document.getElementById('sidebar-resizer');
	const sidebar = document.querySelector<HTMLElement>('.sidebar');
	const settingsSidebar = document.querySelector<HTMLElement>('.settings-sidebar');
	const xplorerBrand = document.querySelector<HTMLElement>('.xplorer-brand');
	const appearance = await Storage.get('appearance');
	const size = appearance?.sidebarWidth ?? '250px';
	sidebar.style.flexBasis = size;
	settingsSidebar.style.flexBasis = size;

	let sidebarText: HTMLElement;
	document.body.addEventListener('mousemove', (e: MouseEvent) => {
		if (sidebar.classList.contains('sidebar-minimized')) {
			if (
				(e.target as HTMLElement).classList.contains('sidebar-item') ||
				((e.target as HTMLElement).parentNode as HTMLElement).classList.contains('sidebar-item') ||
				(e.target as HTMLElement).classList.contains('drive-item') ||
				((e.target as HTMLElement).parentNode as HTMLElement).classList.contains('drive-item')
			) {
				let el = e.target as HTMLElement;
				if (!el.classList.contains('drive-item') && !el.classList.contains('sidebar-item')) {
					el = el.parentElement as HTMLElement;
				}
				sidebarText = el.querySelector('.sidebar-text') as HTMLElement;
				const y = e.clientY - parseInt(getComputedStyle(el).getPropertyValue('padding-top'));
				sidebarText.style.left = `70px`;
				sidebarText.style.top = `${y}px`;
			}
		}
	});

	if (parseInt(size) < 200) {
		sidebar.classList.add('sidebar-minimized');
		settingsSidebar.classList.add('sidebar-minimized');
		xplorerBrand.innerHTML = `<img src=${require('../../Icon/extension/xplorer.svg')} alt="xplorer" />`;
	} else {
		sidebar.classList.remove('sidebar-minimized');
		settingsSidebar.classList.remove('sidebar-minimized');
		xplorerBrand.innerHTML = 'Xplorer';
	}

	sidebarResizer.addEventListener('mousedown', () => {
		document.addEventListener('mousemove', resize, false);
		document.addEventListener(
			'mouseup',
			() => {
				document.removeEventListener('mousemove', resize, false);
			},
			false
		);
	});

	function resize(e: MouseEvent) {
		let size: string;
		if (e.x < 200) {
			sidebar.classList.add('sidebar-minimized');
			settingsSidebar.classList.add('sidebar-minimized');
			xplorerBrand.innerHTML = `<img src=${require('../../Icon/extension/xplorer.svg')} alt="xplorer" />`;
			size = `70px`;
		} else {
			sidebar.classList.remove('sidebar-minimized');
			settingsSidebar.classList.remove('sidebar-minimized');
			xplorerBrand.innerHTML = 'Xplorer';
			size = `${e.x}px`;
		}
		sidebar.style.flexBasis = size;
		appearance.sidebarWidth = size;
		settingsSidebar.style.flexBasis = size;
		Storage.set('appearance', appearance);
	}
};
export default Resizer;
