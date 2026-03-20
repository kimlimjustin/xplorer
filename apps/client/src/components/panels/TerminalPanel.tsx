import React, { useRef, useEffect } from 'react';

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

  useEffect(() => {
    if (!bottomPanelCollapsed && bottomPanelTab === 'terminal' && terminalInputRef.current) {
      terminalInputRef.current.focus();
    }
  }, [bottomPanelCollapsed, bottomPanelTab]);

  const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeTerminalCommand(terminalInput);
      setTerminalInput('');
    }
  };

  return (
    <div className="bg-xp-bg rounded p-3 font-mono text-sm h-full flex flex-col">
      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto mb-2">
        {terminalHistory.map((line, index) => (
          <div
            key={index}
            className={
              line.startsWith(terminalCwd.split(/[\\/]/).pop() || terminalCwd)
                ? 'text-xp-green'
                : 'text-xp-text'
            }
          >
            {line}
          </div>
        ))}
      </div>

      {/* Terminal Input */}
      <div className="flex items-center">
        <span className="text-xp-green mr-2">
          {terminalCwd.split(/[\\/]/).pop() || terminalCwd}
          {'>'}
        </span>
        <input
          ref={terminalInputRef}
          type="text"
          value={terminalInput}
          onChange={(e) => setTerminalInput(e.target.value)}
          onKeyDown={handleTerminalKeyDown}
          className="flex-1 bg-transparent outline-none text-xp-text"
          placeholder="Type a command..."
          autoFocus
        />
      </div>
    </div>
  );
}

export default TerminalPanel;
