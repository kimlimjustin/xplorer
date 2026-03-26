import React, { useRef, useEffect, useCallback } from 'react';
import { TauriAPI } from '@/lib/tauri-api';
import { PATH_SEPARATOR } from '@/lib/constants';

interface TerminalPanelProps {
  terminalHistory: string[];
  terminalInput: string;
  setTerminalInput: (input: string) => void;
  terminalCwd: string;
  executeTerminalCommand: (command: string) => void;
  bottomPanelCollapsed: boolean;
  bottomPanelTab: string;
}

const TerminalPanel = ({
  terminalHistory,
  terminalInput,
  setTerminalInput,
  terminalCwd,
  executeTerminalCommand,
  bottomPanelCollapsed,
  bottomPanelTab,
}: TerminalPanelProps) => {
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalOutputRef = useRef<HTMLDivElement>(null);
  const tabCompletionIndex = useRef(-1);
  const tabCompletionMatches = useRef<string[]>([]);
  const tabCompletionBase = useRef('');

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  // Focus input when terminal is active
  useEffect(() => {
    if (!bottomPanelCollapsed && bottomPanelTab === 'terminal' && terminalInputRef.current) {
      terminalInputRef.current.focus();
    }
  }, [bottomPanelCollapsed, bottomPanelTab]);

  const handleTabCompletion = useCallback(async () => {
    // Extract the last token (word) from the input to complete
    const input = terminalInput;
    const lastSpaceIdx = input.lastIndexOf(' ');
    const partial = lastSpaceIdx >= 0 ? input.substring(lastSpaceIdx + 1) : input;
    const prefix = lastSpaceIdx >= 0 ? input.substring(0, lastSpaceIdx + 1) : '';

    // If we're cycling through existing matches
    if (
      tabCompletionMatches.current.length > 0 &&
      tabCompletionBase.current === partial.split(/[\\/]/).pop()
    ) {
      tabCompletionIndex.current =
        (tabCompletionIndex.current + 1) % tabCompletionMatches.current.length;
      const dirPart =
        partial.includes('\\') || partial.includes('/')
          ? partial.substring(0, Math.max(partial.lastIndexOf('\\'), partial.lastIndexOf('/')) + 1)
          : '';
      setTerminalInput(prefix + dirPart + tabCompletionMatches.current[tabCompletionIndex.current]);
      return;
    }

    try {
      // Determine directory to list and the partial filename to match
      let dirToList = terminalCwd;
      let filePrefix = partial;

      if (partial.includes('\\') || partial.includes('/')) {
        const sepIdx = Math.max(partial.lastIndexOf('\\'), partial.lastIndexOf('/'));
        const dirPart = partial.substring(0, sepIdx + 1);
        filePrefix = partial.substring(sepIdx + 1);

        // Resolve relative to cwd
        if (dirPart.match(/^[A-Za-z]:[\\/]/) || dirPart.startsWith('/')) {
          dirToList = dirPart;
        } else {
          dirToList = terminalCwd + PATH_SEPARATOR + dirPart;
        }
      }

      const files = await TauriAPI.readDirectory(dirToList);
      const lowerPrefix = filePrefix.toLowerCase();
      const matches = files
        .filter((f) => f.name.toLowerCase().startsWith(lowerPrefix))
        .map((f) => (f.is_dir ? f.name + PATH_SEPARATOR : f.name))
        .sort();

      if (matches.length === 0) return;

      tabCompletionMatches.current = matches;
      tabCompletionBase.current = filePrefix;
      tabCompletionIndex.current = 0;

      const dirPart =
        partial.includes('\\') || partial.includes('/')
          ? partial.substring(0, Math.max(partial.lastIndexOf('\\'), partial.lastIndexOf('/')) + 1)
          : '';
      setTerminalInput(prefix + dirPart + matches[0]);
    } catch {
      // Silently fail - no completions available
    }
  }, [terminalInput, terminalCwd, setTerminalInput]);

  const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      tabCompletionMatches.current = [];
      tabCompletionIndex.current = -1;
      executeTerminalCommand(terminalInput);
      setTerminalInput('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabCompletion();
    } else {
      // Reset tab completion state on any other key
      tabCompletionMatches.current = [];
      tabCompletionIndex.current = -1;
    }
  };

  const handleTerminalClick = () => {
    if (terminalInputRef.current) {
      terminalInputRef.current.focus();
    }
  };

  return (
    <div
      className="bg-xp-bg flex h-full cursor-text flex-col font-mono text-xs"
      onClick={handleTerminalClick}
    >
      {/* Terminal Output */}
      <div ref={terminalOutputRef} className="flex-1 overflow-y-auto px-3 pt-2 leading-snug">
        {terminalHistory.slice(-500).map((line, index) => {
          const lineColor = (() => {
            if (line.startsWith(terminalCwd.split(/[\\/]/).pop() || terminalCwd)) {
              return 'text-xp-green';
            }
            if (line.startsWith('Error:')) return 'text-xp-red';
            if (line.startsWith('Warning:')) return 'text-xp-yellow';
            return 'text-xp-text';
          })();
          return (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className={`${lineColor} whitespace-pre-wrap`}
            >
              {line || '\u00A0'}
            </div>
          );
        })}
      </div>

      {/* Terminal Input */}
      <div className="border-xp-border/50 flex items-center border-t px-3 py-1.5">
        <span className="text-xp-green mr-2 select-none">
          {terminalCwd.split(/[\\/]/).pop() || terminalCwd}
          {'>'}
        </span>
        <input
          ref={terminalInputRef}
          type="text"
          value={terminalInput}
          onChange={(e) => setTerminalInput(e.target.value)}
          onKeyDown={handleTerminalKeyDown}
          className="text-xp-text flex-1 bg-transparent font-mono text-xs outline-none"
          placeholder="Type a command..."
          spellCheck={false}
        />
        <button
          onClick={() => executeTerminalCommand('clear')}
          className="text-xp-text-muted hover:text-xp-text ml-2 px-1.5"
          title="Clear (type 'clear')"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default TerminalPanel;
