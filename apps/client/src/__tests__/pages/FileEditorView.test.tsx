import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileEditorView from '@/pages/FileEditorView';

// Mock transport (used for save)
vi.mock('@/lib/transport', () => ({
  transport: vi.fn(() => Promise.resolve()),
  convertAssetUrl: vi.fn((path: string) => `asset://localhost/${path}`),
}));

// Mock editable-files
vi.mock('@/lib/editable-files', () => ({
  getFileExtension: vi.fn((name: string) => {
    const ext = name.split('.').pop() || '';
    return ext;
  }),
}));

// Mock constants
vi.mock('@/lib/constants', () => ({
  COPY_FEEDBACK_MS: 2000,
  isWindows: true,
  PATH_SEPARATOR: '\\',
  ROOT_PATH: 'C:\\',
}));

// Re-import to get mock handles
import { TauriAPI } from '@/lib/tauri-api';
import { transport } from '@/lib/transport';

const mockReadTextFile = TauriAPI.readTextFile as ReturnType<typeof vi.fn>;
const mockTransport = transport as ReturnType<typeof vi.fn>;

const TEST_FILE = 'C:\\test\\example.txt';
const TEST_DOC_FILE = 'C:\\Users\\Test\\document.txt';

describe('FileEditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadTextFile.mockResolvedValue('Hello World\nLine 2\nLine 3');
    mockTransport.mockResolvedValue(undefined);
  });

  describe('Loading State', () => {
    it('shows loading indicator while file is being read', () => {
      // Create a promise that does not resolve immediately
      mockReadTextFile.mockReturnValue(new Promise(() => {}));
      render(<FileEditorView filePath={TEST_FILE} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when file read fails', async () => {
      mockReadTextFile.mockRejectedValue('Permission denied');
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to read file/)).toBeInTheDocument();
      });
    });
  });

  describe('Editor Rendering', () => {
    it('displays the file name in the toolbar', async () => {
      render(<FileEditorView filePath={TEST_DOC_FILE} />);

      await waitFor(() => {
        expect(screen.getByText('document.txt')).toBeInTheDocument();
      });
    });

    it('renders textarea with file content after loading', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea).toBeInTheDocument();
        expect(textarea.value).toBe('Hello World\nLine 2\nLine 3');
      });
    });

    it('shows the line count in the status bar', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByText('3 lines')).toBeInTheDocument();
      });
    });

    it('shows the file extension in the status bar', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByText('TXT')).toBeInTheDocument();
      });
    });

    it('renders line numbers', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('Unsaved Changes', () => {
    it('shows Modified badge when content is changed', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Modified content' } });

      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('does not show Modified badge when content matches original', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      expect(screen.queryByText('Modified')).not.toBeInTheDocument();
    });

    it('disables save button when content is unchanged', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const saveButton = screen.getByTitle('Save (Ctrl+S)');
      expect(saveButton).toBeDisabled();
    });

    it('enables save button when content is modified', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Changed' } });

      const saveButton = screen.getByTitle('Save (Ctrl+S)');
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Save Functionality', () => {
    it('calls transport to save when save button is clicked', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'New content' } });

      const saveButton = screen.getByTitle('Save (Ctrl+S)');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(mockTransport).toHaveBeenCalledWith('agent_write_file_with_permission', {
        filePath: TEST_FILE,
        content: 'New content',
        permissionGranted: true,
      });
    });

    it('removes Modified badge after successful save', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'New content' } });
      expect(screen.getByText('Modified')).toBeInTheDocument();

      const saveButton = screen.getByTitle('Save (Ctrl+S)');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Modified')).not.toBeInTheDocument();
      });
    });

    it('shows error when save fails', async () => {
      mockTransport.mockRejectedValue('Disk full');
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'New content' } });

      const saveButton = screen.getByTitle('Save (Ctrl+S)');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/)).toBeInTheDocument();
      });
    });
  });

  describe('Revert Functionality', () => {
    it('reverts content to original when revert button is clicked', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Modified content' } });
      expect(textarea.value).toBe('Modified content');

      const revertButton = screen.getByTitle('Revert changes');
      fireEvent.click(revertButton);

      expect(textarea.value).toBe('Hello World\nLine 2\nLine 3');
    });

    it('disables revert button when there are no changes', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const revertButton = screen.getByTitle('Revert changes');
      expect(revertButton).toBeDisabled();
    });
  });

  describe('Word Wrap Toggle', () => {
    it('toggles word wrap when the button is clicked', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const wrapButton = screen.getByTitle('Toggle word wrap');
      // Initially word wrap is on (blue color class)
      expect(wrapButton.className).toContain('text-xp-blue');

      fireEvent.click(wrapButton);

      // After toggle, word wrap is off (no text-xp-blue)
      expect(wrapButton.className).not.toContain('text-xp-blue');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('saves on Ctrl+S when content is dirty', async () => {
      render(<FileEditorView filePath={TEST_FILE} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Edited' } });

      // Fire global Ctrl+S event
      await act(async () => {
        fireEvent.keyDown(window, { key: 's', ctrlKey: true });
      });

      expect(mockTransport).toHaveBeenCalledWith(
        'agent_write_file_with_permission',
        expect.objectContaining({
          content: 'Edited',
        }),
      );
    });
  });
});
