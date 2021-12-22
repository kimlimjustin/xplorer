import { invoke } from '@tauri-apps/api';
interface CliArgsReturnType {
	dirs: string[];
	is_reveal: boolean;
	custom_style_sheet: JSON;
}
const CLIInformations = async (): Promise<CliArgsReturnType> => {
	return (await invoke('get_cli_args')) as CliArgsReturnType;
};
export default CLIInformations;
