import { invoke } from '@tauri-apps/api';
import { ICliArguments } from '../Typings/Store/cli';

export const fetchCliInformation = async (): Promise<ICliArguments> => await invoke<ICliArguments>('get_cli_args');