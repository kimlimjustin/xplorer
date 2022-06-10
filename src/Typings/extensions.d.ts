export interface ConsoleMessage {
	message: string;
	level: number;
}
export interface ExtensionMessage {
	message_type: string;
	message: any;
}

export interface InfobarMessage {
	infobar_key: string;
	new_value: string;
}
