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

export const ContextMenu = {
	add_menu: (new_menu: contextMenuItem) => {
		contextmenu_addmenu(new_menu, new_menu.role);
	},
	add_group_menu: (new_menu_group: contextMenuItem[]) => {
		contextmenu_addgroupmenu(new_menu_group, ...new_menu_group.map((item) => item.role));
	},
};

export const Helper = {
	contextMenu: {
		onTopOfFile: 'onTopOfFile',
		onTopOfDir: 'onTopOfDir',
		onMultipleSelected: 'onMultipleSelected',
		onTopOfWorkspace: 'onTopOfWorkspace',
		onTopOfSidebarMenu: 'onTopOfSidebarMenu',
		onTopOfSidebarDriveMenu: 'onTopOfSidebarDriveMenu',
	},
};
