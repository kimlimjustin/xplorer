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
	constructor(menu?: contextMenuItem[][]) {}
	add_menu(new_menu: contextMenuItem) {
		contextmenu_addmenu(new_menu);
	}
	add_group_menu(new_menu_group: contextMenuItem[]) {
		contextmenu_addgroupmenu(new_menu_group);
	}
}

export default ContextMenu;
