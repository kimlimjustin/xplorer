interface contextMenuItem {
	menu: string;
	role?: () => void;
	visible?: boolean;
	icon?: string;
	shortcut?: string;
	submenu?: {
		shortcut?: string;
		name?: string;
		role?: () => void;
		icon?: string;
	}[];
}

class ContextMenu {
	constructor() {}
	add_menu(new_menu: contextMenuItem) {
		contextmenu_addmenu(new_menu.menu, new_menu.role);
	}
	add_group_menu(new_menu_group: contextMenuItem[]) {
		contextmenu_addgroupmenu(new_menu_group, ...new_menu_group.map((item) => item.role));
	}
}

export default ContextMenu;
