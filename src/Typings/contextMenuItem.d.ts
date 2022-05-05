export default interface MenuItem {
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
