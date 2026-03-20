import { useState, useCallback, useEffect } from 'react';
import { TauriAPI } from '@/lib/tauri-api';
import { ROOT_PATH } from '@/lib/constants';
import { TerminalCommands } from '@/components/explorer/TerminalCommands';

// ── Types ────────────────────────────────────────────────────────────────────

interface UseTerminalDeps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
  refetch: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_TERMINAL_LINES = 1000;
const MAX_OUTPUT_LINES = 500;

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useTerminal = (deps: UseTerminalDeps) => {
  const { currentPath, setCurrentPath, refetch } = deps;

  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    'Welcome to Xplorer Terminal',
    'Type "help" to see available commands',
    '',
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalCwd, setTerminalCwd] = useState(ROOT_PATH);

  // Output panel messages
  const [outputMessages, setOutputMessages] = useState<string[]>([
    '[INFO] File explorer initialized',
  ]);

  // Update terminal working directory when path changes
  useEffect(() => {
    if (currentPath !== 'xplorer://home' && currentPath !== 'xplorer://gdrive-manager') {
      setTerminalCwd(currentPath);
    }
  }, [currentPath]);

  // Cap terminal history length
  const cappedSetTerminalHistory: typeof setTerminalHistory = useCallback((action) => {
    setTerminalHistory((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      return next.length > MAX_TERMINAL_LINES ? next.slice(-MAX_TERMINAL_LINES) : next;
    });
  }, []);

  const executeTerminalCommand = useCallback(
    async (command: string) => {
      await TerminalCommands.execute(
        command,
        terminalCwd,
        cappedSetTerminalHistory,
        setTerminalCwd,
        setCurrentPath,
        refetch,
      );
    },
    [terminalCwd, cappedSetTerminalHistory, setCurrentPath, refetch],
  );

  // Listen for terminal output events from backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupEventListener = async () => {
      unlisten = await TauriAPI.listenToTerminalOutput((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setOutputMessages((prev) => {
          const next = [...prev, `[${timestamp}] ${message}`];
          return next.length > MAX_OUTPUT_LINES ? next.slice(-MAX_OUTPUT_LINES) : next;
        });
      });
    };
    setupEventListener();
    return () => {
      unlisten?.();
    };
  }, []);

  return {
    terminalHistory,
    terminalInput,
    setTerminalInput,
    terminalCwd,
    setTerminalCwd,
    executeTerminalCommand,
    outputMessages,
  };
}
