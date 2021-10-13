import SidebarMenu from './configs/sidebarMenu.config';
import SidebarDriveMenu from './configs/sidebarDriveMenu.config';
import BodyMenu from './configs/bodyMenu.config';
import MultipleSelectedMenu from './configs/multipleSelectedMenu.config';
import contextMenuItem from '../../Typings/contextMenuItem';
import fileThumbnail from '../Thumbnail/thumbnail';
import { getSelected } from '../Files/File Operation/select';
import { updateTheme } from '../Theme/theme';
import FileMenu from './configs/fileMenu.config';

let contextMenu = document.querySelector('.contextmenu') as HTMLElement;
let contextMenuSubmenus = document.getElementById('contextmenu-submenus');

interface menuRoles {
	[key: string]: () => void;
}
const menuRoles: menuRoles = {};

document.addEventListener('DOMContentLoaded', () => {
	contextMenu = document.querySelector('.contextmenu') as HTMLElement;
	contextMenuSubmenus = document.getElementById('contextmenu-submenus');
});

const MenuToElements = (menu: contextMenuItem[][]) => {
	menu.forEach((section, index) => {
		section.forEach((item) => {
			if (item.visible || item.visible === undefined) {
				const menu = document.createElement('span');
				menu.classList.add('contextmenu-item');

				if (item.icon) {
					if (item.shortcut)
						menu.innerHTML = `<img src = "${fileThumbnail(
							item.icon,
							'contextmenu',
							false
						)}">${item?.menu.trim()}<span class="contextmenu-item-shortcut">${
							item.shortcut
						}</span>`;
					else
						menu.innerHTML = `<img src = "${fileThumbnail(
							item.icon,
							'contextmenu',
							false
						)}" >${item?.menu?.trim()}`;
				} else {
					if (item.shortcut)
						menu.innerHTML = `${item?.menu?.trim()}<span class="contextmenu-item-shortcut">${
							item.shortcut
						}</span>`;
					else menu.innerHTML = item?.menu?.trim();
				}

				if (typeof item?.role === 'function') {
					const roleIdentifier =
						Math.random().toString(36).substr(2, 10) +
						item?.menu?.replace(/\W/g, '')?.trim();
					menu.setAttribute('role', roleIdentifier);
					menuRoles[roleIdentifier] = item?.role;
				}
				contextMenu.appendChild(menu);

				const submenuId = Math.random().toString(36).substr(2, 10);

				// Create submenu element for context menu
				if (item.submenu) {
					const submenu = document.createElement('div');
					submenu.classList.add('contextmenu-submenu');

					menu.dataset.submenu = submenuId;
					submenu.id = submenuId;

					contextMenuSubmenus.appendChild(submenu);
					item.submenu.forEach((submenuItem) => {
						const submenuItemElement =
							document.createElement('span');
						submenuItemElement.classList.add('contextmenu-item');

						if (submenuItem.shortcut)
							submenuItemElement.innerHTML = `${
								submenuItem.name ?? submenuItem
							}<span class="contextmenu-item-shortcut">${
								submenuItem.shortcut
							}</span>`;
						else submenuItemElement.innerHTML = submenuItem.name;

						if (typeof submenuItem?.role === 'function') {
							const roleIdentifier =
								Math.random().toString(36).substr(2, 10) +
								submenuItem?.name?.replace(/\W/g, '')?.trim();
							submenuItemElement.setAttribute(
								'role',
								roleIdentifier
							);
							menuRoles[roleIdentifier] = submenuItem?.role;
						}

						submenu.appendChild(submenuItemElement);
					});
				}
			}
		});
		if (
			index !== menu.length - 1 &&
			section.filter((menu) => menu.visible !== false).length > 0
		)
			contextMenu.innerHTML += `<hr />`;
	});
};

/**
 * Context menu initializer
 * @returns {void}
 */
const ContextMenu = (): void => {
	document.addEventListener('contextmenu', (e) => {
		contextMenu.innerHTML = '';
		contextMenuSubmenus.innerHTML = '';
		let coorX = e.pageX;
		let coorY = e.pageY;

		let target = e.target as HTMLElement;
		while (!target.dataset.path) {
			target = target.parentNode as HTMLElement;
		}

		const filePath = unescape(target.dataset.path);

		// Create the context menu
		if (getSelected().length > 1) {
			MenuToElements(MultipleSelectedMenu(target, filePath));
		} else if (target.classList.contains('sidebar-item')) {
			MenuToElements(SidebarMenu(target, filePath));
		} else if (target.classList.contains('drive-item')) {
			MenuToElements(SidebarDriveMenu(target, filePath));
		} else if (target === document.getElementById('workspace')) {
			MenuToElements(BodyMenu(target, filePath));
		} else {
			MenuToElements(FileMenu(target, filePath));
		}

		if (
			coorY + contextMenu.offsetHeight > window.innerHeight &&
			coorY - contextMenu.offsetHeight > -50
		) {
			coorY -= contextMenu.offsetHeight;
		}
		if (coorX + contextMenu.offsetWidth > window.innerWidth)
			coorX = window.innerWidth - contextMenu.offsetWidth;

		contextMenu.style.left = coorX + 'px';
		contextMenu.style.top = coorY + 'px';

		updateTheme();
		document.addEventListener('click', exitContextMenu);
	});
	const exitContextMenu = () => {
		contextMenu.style.left = '-100vw';
		contextMenu.style.top = '-100vh';
		contextMenuSubmenus.innerHTML = '';
		document.removeEventListener('click', exitContextMenu);
	};

	// Submenu handler
	document.addEventListener('mousemove', (e) => {
		// Expand contextmenu
		if (
			(e.pageX >= contextMenu.offsetLeft + contextMenu.offsetWidth - 15 ||
				e.pageX <= contextMenu.offsetLeft + 15) &&
			e.pageX < contextMenu.offsetLeft + contextMenu.offsetWidth + 100
		) {
			return;
		}

		if (
			!(
				(e.target as HTMLElement).parentNode as HTMLElement
			).className.startsWith('contextmenu-submenu')
		) {
			document
				.querySelectorAll('.contextmenu-submenu')
				.forEach(
					(submenu) =>
						((submenu as HTMLElement).style.display = 'none')
				);
		}
		if (
			(e.target as HTMLElement).dataset.submenu ||
			(
				(e.target as HTMLElement).parentNode as HTMLElement
			).className.startsWith('contextmenu-submenu')
		) {
			const submenuElement = document.getElementById(
				(e.target as HTMLElement).dataset.submenu
			);
			if (!submenuElement) return;

			const menuCoordinate = (
				e.target as HTMLElement
			).getBoundingClientRect();

			submenuElement.style.display = 'block';

			let submenuCoorX = contextMenu.offsetLeft + contextMenu.offsetWidth;
			if (
				submenuCoorX + submenuElement.offsetWidth * 0.5 >=
				window.innerWidth
			) {
				submenuCoorX =
					contextMenu.offsetLeft - submenuElement.offsetWidth;
			}
			submenuElement.style.left = submenuCoorX + 'px';
			submenuElement.style.top = menuCoordinate.top + 'px';
		}
	});

	contextMenu.addEventListener('click', (e) => {
		exitContextMenu();

		const menuClicked = e.target as HTMLElement;
		const menuRole = menuClicked?.getAttribute('role');
		if (!menuRole) return;

		menuRoles[menuRole]();
	});
	contextMenuSubmenus.addEventListener('click', (e) => {
		exitContextMenu();

		const menuClicked = e.target as HTMLElement;
		const menuRole = menuClicked?.getAttribute('role');
		if (!menuRole) return;

		menuRoles[menuRole]();
	});
};

export default ContextMenu;
