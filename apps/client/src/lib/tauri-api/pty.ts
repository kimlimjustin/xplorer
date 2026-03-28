import { transport, listenToEvent } from '../transport';

export const ptySpawn = async (
  sessionId: string,
  cwd: string,
  cols: number,
  rows: number,
): Promise<void> => await transport('pty_spawn', { sessionId, cwd, cols, rows });

export const ptyWrite = async (sessionId: string, data: string): Promise<void> =>
  await transport('pty_write', { sessionId, data });

export const ptyResize = async (sessionId: string, cols: number, rows: number): Promise<void> =>
  await transport('pty_resize', { sessionId, cols, rows });

export const ptyKill = async (sessionId: string): Promise<void> =>
  await transport('pty_kill', { sessionId });

export const ptyKillAll = async (): Promise<void> => await transport('pty_kill_all');

export interface PtyOutputPayload {
  session_id: string;
  data: string;
}

export const listenToPtyOutput = async (
  callback: (payload: PtyOutputPayload) => void,
): Promise<() => void> => listenToEvent<PtyOutputPayload>('pty-output', callback);

export const listenToPtyExit = async (callback: (sessionId: string) => void): Promise<() => void> =>
  listenToEvent<string>('pty-exit', callback);
