import { invoke } from '@tauri-apps/api';
import { CliArguments } from '../Typings/Store/cli';

export const getCliInformation = async (): Promise<CliArguments> => await invoke('get_cli_args');