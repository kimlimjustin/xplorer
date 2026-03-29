import { transport, listenToEvent } from '../transport';

export const getAppVersion = async (): Promise<string> => {
  return await transport('get_app_version');
};

export const getSystemInfo = async (): Promise<{
  os: string;
  arch: string;
  version: string;
  hostname: string;
}> => {
  return await transport('get_system_info');
};

export const getUserDirectories = async (): Promise<{
  home: string;
  documents: string;
  downloads: string;
  desktop: string;
  pictures: string;
  videos: string;
  music: string;
}> => {
  return await transport('get_user_directories');
};

export const listDrives = async (): Promise<
  {
    letter: string;
    label: string;
    path: string;
    total_space: number;
    free_space: number;
  }[]
> => {
  return await transport('list_drives');
};

export const executeCommand = async (
  command: string,
  workingDir: string,
): Promise<{ stdout: string; stderr: string; exit_code: number }> => {
  return await transport('execute_command', { command, workingDir });
};

export const executeCommandStream = async (command: string, workingDir: string): Promise<void> => {
  return await transport('execute_command_stream', { command, workingDir });
};

export const getCurrentShell = async (): Promise<string> => {
  return await transport('get_current_shell');
};

export const openInTerminal = async (path: string): Promise<void> => {
  return await transport('open_in_terminal', { path });
};

export const showOpenDialog = async (options: {
  multiple?: boolean;
  directory?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string[] | null> => {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');

    const result = await open({
      multiple: options.multiple || false,
      directory: options.directory || false,
      filters: options.filters || [],
    });

    if (result === null) return null;

    return Array.isArray(result) ? result : [result];
  } catch (error) {
    console.error('Error opening dialog:', error);
    return null;
  }
};

export const listenToTerminalOutput = (
  callback: (message: string) => void,
): Promise<() => void> => {
  return listenToEvent<string>('terminal-output', callback);
};
