export interface Theme {
	[key: string]: themeValue;
}
export interface themeValue {
	[key: string]: string;
}

export interface themeData {
	availableThemes: [
		{
			identifier: string;
			source: string;
		}
	];
	theme: string;
}
