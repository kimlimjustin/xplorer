import { invoke } from '@tauri-apps/api';
interface CliArgsReturnType {
	args: string[];
	flags: string[];
}
const CLIInformations = async (): Promise<{
	args: string[];
	flags: string[];
}> => {
	const { args, flags } = (await invoke('get_cli_args')) as CliArgsReturnType;
	return { args, flags };
};
export default CLIInformations;
