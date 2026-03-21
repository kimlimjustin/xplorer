import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BottomPanel from '@/components/panels/BottomPanel';

// Helper to render with Suspense boundary for lazy-loaded child components
const renderWithSuspense = (ui: React.ReactElement) => {
  return render(<React.Suspense fallback={<div>Loading...</div>}>{ui}</React.Suspense>);
};

// Mock sub-panels (lazy-loaded)
vi.mock('@/components/panels/TerminalPanelEnhanced', () => ({
  default: (props: Record<string, unknown> & { terminalCwd?: string }) => (
    <div data-testid="terminal-panel">Terminal: {props.terminalCwd}</div>
  ),
}));
vi.mock('@/components/panels/UndoHistoryPanel', () => ({
  default: () => <div data-testid="undo-history-panel">Undo History</div>,
}));
vi.mock('@/components/panels/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center">Notifications</div>,
}));
vi.mock('@/components/panels/ClipboardHistoryPanel', () => ({
  default: ({ onPaste: _onPaste }: { onPaste?: () => void }) => (
    <div data-testid="clipboard-panel">Clipboard</div>
  ),
}));
vi.mock('@/components/panels/ChangeReviewPanel', () => ({
  default: ({ changes }: { changes?: unknown }) => (
    <div data-testid="change-review-panel">Changes: {changes?.totalCount}</div>
  ),
}));
vi.mock('@/components/panels/ActivityFeedWrapper', () => ({
  default: () => <div data-testid="activity-feed-panel">Activity Feed</div>,
}));
vi.mock('@/hooks/use-notification-history', () => ({
  useNotificationHistory: () => ({ unreadCount: 0 }),
}));
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/extension-host', () => ({
  extensionHost: {
    getBottomTabs: vi.fn(() => []),
    getBottomTabRenderer: vi.fn(() => null),
  },
}));

describe('BottomPanel', () => {
  const mockSetBottomPanelCollapsed = vi.fn();
  const mockSetBottomPanelTab = vi.fn();
  const mockSetTerminalInput = vi.fn();
  const mockExecuteTerminalCommand = vi.fn();
  const mockOnPasteFromHistory = vi.fn();
  const mockOnNavigate = vi.fn();
  const mockOnDismissChanges = vi.fn();

  const defaultProps = {
    bottomPanelCollapsed: false,
    setBottomPanelCollapsed: mockSetBottomPanelCollapsed,
    bottomPanelTab: 'terminal' as const,
    setBottomPanelTab: mockSetBottomPanelTab,
    terminalHistory: [] as string[],
    terminalInput: '',
    setTerminalInput: mockSetTerminalInput,
    terminalCwd: 'C:\\Users\\Test',
    executeTerminalCommand: mockExecuteTerminalCommand,
    files: [{ name: 'file1.txt', path: 'C:\\Users\\Test\\file1.txt', is_dir: false, size: 100 }],
    currentPath: 'C:\\Users\\Test',
    themes: { glass: { name: 'Glass' } } as Record<string, { name: string }>,
    theme: 'glass',
    selectedFiles: new Set<string>(),
    selectedFile: null,
    outputMessages: ['[INFO] Ready'],
    onNavigate: mockOnNavigate,
    onPasteFromHistory: mockOnPasteFromHistory,
    fileChanges: null,
    onDismissChanges: mockOnDismissChanges,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Collapsed state', () => {
    it('returns null when collapsed', () => {
      const { container } = render(<BottomPanel {...defaultProps} bottomPanelCollapsed={true} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when not collapsed', () => {
      const { container } = render(<BottomPanel {...defaultProps} />);
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('Tab rendering', () => {
    it('renders all tab buttons', () => {
      render(<BottomPanel {...defaultProps} />);

      const tabs = [
        'TERMINAL',
        'ACTIVITY LOG',
        'CHANGES',
        'CLIPBOARD',
        'NOTIFICATIONS',
        'PROPERTIES',
      ];
      tabs.forEach((tab) => {
        expect(screen.getByText(tab)).toBeInTheDocument();
      });
    });

    it('highlights the active tab', () => {
      render(<BottomPanel {...defaultProps} bottomPanelTab="terminal" />);

      const terminalTab = screen.getByText('TERMINAL');
      expect(terminalTab.closest('button')?.className).toContain('border-xp-blue');
    });

    it('renders close button', () => {
      render(<BottomPanel {...defaultProps} />);

      const closeButton = screen.getByTitle('Close (Ctrl+J)');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Tab switching', () => {
    it('calls setBottomPanelTab when clicking a tab', () => {
      render(<BottomPanel {...defaultProps} />);

      fireEvent.click(screen.getByText('ACTIVITY LOG'));
      expect(mockSetBottomPanelTab).toHaveBeenCalledWith('activity-log');
    });

    it('calls setBottomPanelTab with clipboard', () => {
      render(<BottomPanel {...defaultProps} />);

      fireEvent.click(screen.getByText('CLIPBOARD'));
      expect(mockSetBottomPanelTab).toHaveBeenCalledWith('clipboard');
    });
  });

  describe('Collapse behavior', () => {
    it('calls setBottomPanelCollapsed(true) when close button clicked', () => {
      render(<BottomPanel {...defaultProps} />);

      fireEvent.click(screen.getByTitle('Close (Ctrl+J)'));
      expect(mockSetBottomPanelCollapsed).toHaveBeenCalledWith(true);
    });
  });

  describe('Tab content', () => {
    it('shows terminal panel when terminal tab is active', async () => {
      renderWithSuspense(<BottomPanel {...defaultProps} bottomPanelTab="terminal" />);
      expect(await screen.findByTestId('terminal-panel')).toBeInTheDocument();
    });

    it('shows output messages in activity-log tab', () => {
      render(
        <BottomPanel
          {...defaultProps}
          bottomPanelTab="activity-log"
          outputMessages={['[INFO] Ready']}
        />,
      );
      expect(screen.getByText('[INFO] Ready')).toBeInTheDocument();
    });

    it('shows file count in activity-log tab', () => {
      render(<BottomPanel {...defaultProps} bottomPanelTab="activity-log" />);
      expect(screen.getByText(/Loaded 1 files from/)).toBeInTheDocument();
    });

    it('shows theme info in activity-log tab', () => {
      render(<BottomPanel {...defaultProps} bottomPanelTab="activity-log" />);
      expect(screen.getByText(/Theme applied: Glass/)).toBeInTheDocument();
    });

    it('shows selection count in activity-log tab when files selected', () => {
      render(
        <BottomPanel
          {...defaultProps}
          bottomPanelTab="activity-log"
          selectedFiles={new Set(['C:\\Users\\Test\\file1.txt'])}
        />,
      );
      expect(screen.getByText(/1 file\(s\) selected/)).toBeInTheDocument();
    });

    it('shows active file in activity-log tab', () => {
      render(
        <BottomPanel
          {...defaultProps}
          bottomPanelTab="activity-log"
          selectedFile={{
            name: 'file1.txt',
            path: 'C:\\Users\\Test\\file1.txt',
            is_dir: false,
            size: 100,
          }}
        />,
      );
      expect(screen.getByText(/Active file: file1.txt/)).toBeInTheDocument();
    });

    it('shows undo history panel in activity-log tab', async () => {
      renderWithSuspense(<BottomPanel {...defaultProps} bottomPanelTab="activity-log" />);
      expect(await screen.findByTestId('undo-history-panel')).toBeInTheDocument();
    });

    it('shows activity feed in activity-log tab', async () => {
      renderWithSuspense(<BottomPanel {...defaultProps} bottomPanelTab="activity-log" />);
      expect(await screen.findByTestId('activity-feed-panel')).toBeInTheDocument();
    });

    it('shows clipboard panel when clipboard tab is active', async () => {
      renderWithSuspense(<BottomPanel {...defaultProps} bottomPanelTab="clipboard" />);
      expect(await screen.findByTestId('clipboard-panel')).toBeInTheDocument();
    });

    it('shows notification center when notifications tab is active', async () => {
      renderWithSuspense(<BottomPanel {...defaultProps} bottomPanelTab="notifications" />);
      expect(await screen.findByTestId('notification-center')).toBeInTheDocument();
    });

    it('shows no changes message when changes tab is empty', () => {
      render(<BottomPanel {...defaultProps} bottomPanelTab="changes" />);
      expect(screen.getByText('No external file changes detected')).toBeInTheDocument();
    });

    it('shows change review panel when changes exist', async () => {
      renderWithSuspense(
        <BottomPanel
          {...defaultProps}
          bottomPanelTab="changes"
          fileChanges={{ totalCount: 5, added: [], removed: [], modified: [] } as unknown}
        />,
      );
      expect(await screen.findByTestId('change-review-panel')).toBeInTheDocument();
    });
  });

  describe('Badge counts', () => {
    it('shows changes count badge when there are file changes', () => {
      render(
        <BottomPanel
          {...defaultProps}
          fileChanges={{ totalCount: 3, added: [], removed: [], modified: [] } as unknown}
        />,
      );
      // The CHANGES tab should have a badge with the count
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Height prop', () => {
    it('uses default height of 192 when not specified', () => {
      const { container } = render(<BottomPanel {...defaultProps} />);
      const panel = container.firstChild as HTMLElement;
      expect(panel.style.height).toBe('192px');
    });

    it('uses custom height when specified', () => {
      const { container } = render(<BottomPanel {...defaultProps} height={300} />);
      const panel = container.firstChild as HTMLElement;
      expect(panel.style.height).toBe('300px');
    });
  });
});
