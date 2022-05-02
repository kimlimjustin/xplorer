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
declare function contextmenu_addmenu(menu: contextMenuItem.menu, role: contextMenuItem.role);
declare function contextmenu_addgroupmenu(menu: contextMenuItem[], ...role: contextMenuItem.role[]);
