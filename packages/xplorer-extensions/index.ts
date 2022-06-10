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

export class InfobarMenu {
	private _infobar_key;
	constructor(infobar_key: string) {
		this._infobar_key = infobar_key;
	}
	public edit(value: string) {
		edit_infobar_value(this._infobar_key, value);
	}
}

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
