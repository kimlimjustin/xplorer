export interface Theme {
	[key: string]: string;
}

export interface CustomTheme {
	author: string;
	name: string;
	description: string;
	version: string;
	identifier: string;
	homepage: string;
	license: string;
	repository: string;
	theme: Theme;
}
