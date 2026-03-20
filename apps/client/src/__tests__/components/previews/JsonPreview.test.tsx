import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import JsonPreview from '@/components/previews/JsonPreview';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';

// Mock TauriAPI
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readTextFile: vi.fn(),
  },
  FileEntry: {}, // Mock FileEntry type export
}));

describe('JsonPreview', () => {
  const mockFile: FileEntry = {
    name: 'test.json',
    path: 'C:\\Users\\Test\\test.json',
    size: 1024,
    is_dir: false,
    modified: Date.now(),
    file_type: 'json',
  };

  const mockProps = {
    file: mockFile,
    onError: vi.fn(),
    onLoad: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading States', () => {
    it('shows loading state initially', () => {
      vi.mocked(TauriAPI.readTextFile).mockImplementation(() => new Promise(() => {}));

      render(<JsonPreview {...mockProps} />);

      expect(screen.getByText('Loading JSON...')).toBeInTheDocument();
    });
  });

  describe('Success Cases', () => {
    it('displays JSON content in formatted view by default', async () => {
      const jsonContent = '{"name": "test", "value": 123, "active": true}';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(jsonContent);

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('"test"')).toBeInTheDocument();
        expect(screen.getByText('123')).toBeInTheDocument();
        expect(screen.getByText('true')).toBeInTheDocument();
      });

      expect(mockProps.onLoad).toHaveBeenCalled();
    });

    it('displays formatted and raw view toggle buttons', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"test": true}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Formatted')).toBeInTheDocument();
        expect(screen.getByText('Raw')).toBeInTheDocument();
      });
    });

    it('switches between formatted and raw views', async () => {
      const jsonContent = '{"name": "test", "nested": {"value": 42}}';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(jsonContent);

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('"test"')).toBeInTheDocument();
      });

      // Switch to raw view
      const rawButton = screen.getByText('Raw');
      fireEvent.click(rawButton);

      const preElement = screen.getByText(/nested/).closest('pre');
      expect(preElement).toHaveTextContent(jsonContent);
    });

    it('highlights formatted button by default', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"test": true}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const formattedButton = screen.getByText('Formatted');
        expect(formattedButton).toHaveClass('bg-xp-blue', 'text-white');

        const rawButton = screen.getByText('Raw');
        expect(rawButton).not.toHaveClass('bg-xp-blue', 'text-white');
      });
    });

    it('highlights raw button when selected', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"test": true}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const rawButton = screen.getByText('Raw');
        fireEvent.click(rawButton);

        expect(rawButton).toHaveClass('bg-xp-blue', 'text-white');

        const formattedButton = screen.getByText('Formatted');
        expect(formattedButton).not.toHaveClass('bg-xp-blue', 'text-white');
      });
    });

    it('displays preview title', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"test": true}');

      render(<JsonPreview {...mockProps} />);

      expect(screen.getByText('JSON Preview')).toBeInTheDocument();
    });
  });

  describe('JSON Formatting', () => {
    it('formats strings with correct color', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"message": "hello world"}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const stringElement = screen.getByText('"hello world"');
        expect(stringElement).toHaveClass('text-xp-green');
      });
    });

    it('formats numbers with correct color', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"count": 42, "price": 99.99}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const numberElements = screen.getAllByText(
          (content, element) => element?.textContent === '42' || element?.textContent === '99.99',
        );

        numberElements.forEach((element) => {
          expect(element).toHaveClass('text-xp-blue');
        });
      });
    });

    it('formats booleans with correct color', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"active": true, "deleted": false}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const booleanElements = screen.getAllByText(
          (content, element) => element?.textContent === 'true' || element?.textContent === 'false',
        );

        booleanElements.forEach((element) => {
          expect(element).toHaveClass('text-xp-purple');
        });
      });
    });

    it('formats null values correctly', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"value": null}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const nullElement = screen.getByText('null');
        expect(nullElement).toHaveClass('text-xp-text-muted');
      });
    });

    it('formats object keys with correct color', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"keyName": "value"}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const keyElement = screen.getByText('"keyName"');
        expect(keyElement).toHaveClass('text-xp-cyan');
      });
    });

    it('handles nested objects correctly', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"parent": {"child": "value"}}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('"parent"')).toBeInTheDocument();
        expect(screen.getByText('"child"')).toBeInTheDocument();
        expect(screen.getByText('"value"')).toBeInTheDocument();
      });
    });

    it('handles arrays correctly', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"items": ["first", "second", 123]}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('"first"')).toBeInTheDocument();
        expect(screen.getByText('"second"')).toBeInTheDocument();
        expect(screen.getByText('123')).toBeInTheDocument();
      });
    });

    it('handles empty objects and arrays', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"empty_object": {}, "empty_array": []}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('{}')).toBeInTheDocument();
        expect(screen.getByText('[]')).toBeInTheDocument();
      });
    });
  });

  describe('Error Cases', () => {
    it('shows error when file is too large', async () => {
      const largeFile = { ...mockFile, size: 6 * 1024 * 1024 }; // 6MB

      render(<JsonPreview {...mockProps} file={largeFile} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview JSON')).toBeInTheDocument();
        expect(screen.getByText('File is too large for preview')).toBeInTheDocument();
      });
    });

    it('shows error when JSON is invalid', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"invalid": json}'); // Invalid JSON

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview JSON')).toBeInTheDocument();
        expect(screen.getByText('Invalid JSON format')).toBeInTheDocument();
      });
    });

    it('shows error when file read fails', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValue(new Error('File not found'));

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview JSON')).toBeInTheDocument();
        expect(screen.getByText('File not found')).toBeInTheDocument();
      });

      expect(mockProps.onError).toHaveBeenCalled();
    });

    it('handles non-Error rejections', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValue('String error');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load JSON file')).toBeInTheDocument();
      });
    });
  });

  describe('View Mode State', () => {
    it('maintains view mode when content updates', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"initial": true}');

      const { rerender } = render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const rawButton = screen.getByText('Raw');
        fireEvent.click(rawButton);
        expect(rawButton).toHaveClass('bg-xp-blue');
      });

      // Update with new content
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"updated": false}');
      const updatedFile = { ...mockFile, path: 'new_path.json' };
      rerender(<JsonPreview {...mockProps} file={updatedFile} />);

      await waitFor(() => {
        // Should still be in raw view
        const rawButton = screen.getByText('Raw');
        expect(rawButton).toHaveClass('bg-xp-blue');
      });
    });
  });

  describe('CSS Classes and Styling', () => {
    it('applies correct container classes', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"test": true}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const container = screen.getByText('true').closest('.bg-xp-surface');
        expect(container).toHaveClass(
          'bg-xp-surface',
          'border',
          'border-xp-border',
          'rounded',
          'p-3',
          'max-h-64',
          'overflow-y-auto',
        );
      });
    });

    it('applies correct classes to formatted view', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"test": true}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const formattedContainer = screen.getByText('true').closest('div.text-xs');
        expect(formattedContainer).toHaveClass('text-xs', 'font-mono', 'text-xp-text');
      });
    });

    it('applies correct classes to raw view', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"test": true}');

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        const rawButton = screen.getByText('Raw');
        fireEvent.click(rawButton);

        const preElement = screen.getByText(/"test"/).closest('pre');
        expect(preElement).toHaveClass(
          'text-xs',
          'font-mono',
          'whitespace-pre-wrap',
          'text-xp-text',
          'break-words',
        );
      });
    });
  });

  describe('Callback Handling', () => {
    it('works without optional callbacks', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('{"test": true}');

      const propsWithoutCallbacks = { file: mockFile };

      expect(() => render(<JsonPreview {...propsWithoutCallbacks} />)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('"test"')).toBeInTheDocument();
      });
    });
  });

  describe('Complex JSON Structures', () => {
    it('handles deeply nested structures', async () => {
      const deepJson = JSON.stringify({
        level1: {
          level2: {
            level3: {
              value: 'deep value',
            },
          },
        },
      });
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(deepJson);

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('"deep value"')).toBeInTheDocument();
      });
    });

    it('handles large arrays', async () => {
      const largeArray = JSON.stringify({
        items: new Array(10).fill(0).map((_, i) => `item${i}`),
      });
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(largeArray);

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('"item0"')).toBeInTheDocument();
        expect(screen.getByText('"item9"')).toBeInTheDocument();
      });
    });

    it('handles mixed data types', async () => {
      const mixedJson = JSON.stringify({
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 'two', false],
        object: { nested: 'value' },
      });
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(mixedJson);

      render(<JsonPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('"text"')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('true')).toBeInTheDocument();
        expect(screen.getByText('null')).toBeInTheDocument();
        expect(screen.getByText('"two"')).toBeInTheDocument();
        expect(screen.getByText('false')).toBeInTheDocument();
      });
    });
  });
});
