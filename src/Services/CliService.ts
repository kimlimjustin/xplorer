import { invoke } from '@tauri-apps/api';
import { CliArguments } from '../Typings/Store/cli';

export const fetchCliInformation = async (): Promise<CliArguments> => await invoke<CliArguments>('get_cli_args');