declare module 'electron-prompt' {
	interface Options {
		width?: number;
		height?: number;
		minWidth?: number;
		minHeight?: number;
		resizable?: boolean;
		title?: string;
		label?: string;
		buttonLabels?: any;
		alwaysOnTop?: boolean;
		value?: any;
		type?: string;
		selectOptions?: any;
		icon?: any;
		useHtmllabel?: any;
		customStylesheet?: any;
		menuBarVisible?: boolean;
		skipTaskbar?: boolean;
		inputAttrs: {
			type: string;
			required: boolean;
		};
	}
	function fn(options: Options, parentWindow?: any): any;
	export = fn;
}
