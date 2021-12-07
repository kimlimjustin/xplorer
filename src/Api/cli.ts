import { invoke } from '@tauri-apps/api';
import { CliArguments } from '../Typings/Store/cli';

const CLIInformations = async (): Promise<{
	args: string[];
	flags: string[];
}> => {
	const { args, flags } = (await invoke('get_cli_args')) as CliArguments;
	return { args, flags };
};
export default CLIInformations;
