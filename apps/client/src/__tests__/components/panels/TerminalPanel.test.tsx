import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TerminalPanel from '@/components/panels/TerminalPanelEnhanced';

describe('TerminalPanel', () => {
  const mockSetTerminalInput = vi.fn();
  const mockExecuteTerminalCommand = vi.fn();

  const defaultProps = {
    terminalHistory: [] as string[],
    terminalInput: '',
    setTerminalInput: mockSetTerminalInput,
    terminalCwd: 'C:\\Users\\Test',
    executeTerminalCommand: mockExecuteTerminalCommand,
    bottomPanelCollapsed: false,
    bottomPanelTab: 'terminal',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the terminal input', () => {
      render(<TerminalPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type a command...');
      expect(input).toBeInTheDocument();
    });

    it('renders the prompt with the current directory name', () => {
      render(<TerminalPanel {...defaultProps} />);

      expect(screen.getByText('Test>')).toBeInTheDocument();
    });

    it('renders the clear button', () => {
      render(<TerminalPanel {...defaultProps} />);

      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('shows empty state when no history', () => {
      const { container } = render(<TerminalPanel {...defaultProps} />);

      // The output area should exist but be empty (no line divs)
      const outputArea = container.querySelector('.flex-1.overflow-y-auto');
      expect(outputArea).toBeInTheDocument();
      expect(outputArea?.children.length).toBe(0);
    });
  });

  describe('Terminal Output', () => {
    it('shows terminal output lines', () => {
      const history = ['Test> echo hello', 'hello', 'Test> ls', 'file1.txt  file2.txt'];
      render(<TerminalPanel {...defaultProps} terminalHistory={history} />);

      expect(screen.getByText('Test> echo hello')).toBeInTheDocument();
      expect(screen.getByText('hello')).toBeInTheDocument();
      expect(screen.getByText('Test> ls')).toBeInTheDocument();
      expect(screen.getByText('file1.txt file2.txt')).toBeInTheDocument();
    });

    it('colors error lines with red class', () => {
      const history = ['Error: file not found'];
      render(<TerminalPanel {...defaultProps} terminalHistory={history} />);

      const errorLine = screen.getByText('Error: file not found');
      expect(errorLine.className).toContain('text-xp-red');
    });

    it('colors warning lines with yellow class', () => {
      const history = ['Warning: deprecated command'];
      render(<TerminalPanel {...defaultProps} terminalHistory={history} />);

      const warningLine = screen.getByText('Warning: deprecated command');
      expect(warningLine.className).toContain('text-xp-yellow');
    });

    it('limits rendered lines to last 500', () => {
      // Generate 600 lines
      const history = Array.from({ length: 600 }, (_, i) => `line ${i}`);
      const { container } = render(<TerminalPanel {...defaultProps} terminalHistory={history} />);

      const outputArea = container.querySelector('.flex-1.overflow-y-auto');
      // Should only render the last 500 lines
      expect(outputArea?.children.length).toBe(500);

      // First rendered line should be line 100 (600 - 500 = 100)
      expect(screen.getByText('line 100')).toBeInTheDocument();
      expect(screen.queryByText('line 99')).not.toBeInTheDocument();
    });
  });

  describe('Input Interactions', () => {
    it('calls setTerminalInput when typing', () => {
      render(<TerminalPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.change(input, { target: { value: 'ls' } });

      expect(mockSetTerminalInput).toHaveBeenCalledWith('ls');
    });

    it('executes command and clears input on Enter', () => {
      render(<TerminalPanel {...defaultProps} terminalInput="echo hello" />);

      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockExecuteTerminalCommand).toHaveBeenCalledWith('echo hello');
      expect(mockSetTerminalInput).toHaveBeenCalledWith('');
    });

    it('does not execute on non-Enter key press', () => {
      render(<TerminalPanel {...defaultProps} terminalInput="ls" />);

      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.keyDown(input, { key: 'a' });

      expect(mockExecuteTerminalCommand).not.toHaveBeenCalled();
    });

    it('executes clear command when Clear button is clicked', () => {
      render(<TerminalPanel {...defaultProps} />);

      fireEvent.click(screen.getByText('Clear'));

      expect(mockExecuteTerminalCommand).toHaveBeenCalledWith('clear');
    });

    it('focuses input when terminal area is clicked', () => {
      const { container } = render(<TerminalPanel {...defaultProps} />);

      const terminalDiv = container.firstChild as HTMLElement;
      fireEvent.click(terminalDiv);

      // The input should be focused
      const input = screen.getByPlaceholderText('Type a command...');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('Tab Completion', () => {
    it('prevents default on Tab key press', () => {
      render(<TerminalPanel {...defaultProps} terminalInput="fil" />);

      const input = screen.getByPlaceholderText('Type a command...');
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      const prevented = !input.dispatchEvent(event);

      // Tab should be intercepted (prevented)
      expect(prevented).toBe(true);
    });
  });
});
