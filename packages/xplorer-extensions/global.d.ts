interface contextMenuItem {
	menu: string;
	role?: () => void;
	visible?: boolean | string | Array<boolean | string>;
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
declare function add_infobar(infobar_key: String);
declare function edit_infobar_value(infobar_key: String, new_value: String);
