import isTauri from '../Util/is-tauri';
interface CliArgsReturnType {
	dirs: string[];
	is_reveal: boolean;
	custom_style_sheet: JSON;
}
const CLIInformations = async (): Promise<CliArgsReturnType> => {
	if (!isTauri)
		return {
			dirs: [],
			is_reveal: false,
			custom_style_sheet: {} as JSON,
		};
	const { invoke } = require('@tauri-apps/api');
	return (await invoke('get_cli_args')) as CliArgsReturnType;
};
export default CLIInformations;
