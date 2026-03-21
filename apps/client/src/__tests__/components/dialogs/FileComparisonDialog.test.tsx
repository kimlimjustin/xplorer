import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FileComparisonDialog from '@/components/dialogs/FileComparisonDialog';
import { FileComparison } from '@/lib/file-comparison';

// Mock the file comparison class
vi.mock('@/lib/file-comparison', () => ({
  FileComparison: {
    compareFiles: vi.fn(),
  },
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Scale: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="scale-icon" className={className} {...props} />
  ),
  Clock: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="clock-icon" className={className} {...props} />
  ),
  Hash: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="hash-icon" className={className} {...props} />
  ),
  FileIcon: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="file-icon" className={className} {...props} />
  ),
  X: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="x-icon" className={className} {...props} />
  ),
  AlertTriangle: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="alert-triangle-icon" className={className} {...props} />
  ),
}));

// Mock dialog components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children?: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

// Mock other UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: Record<string, unknown> & {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler;
  }) => (
    <button data-testid="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/tabs', () => {
  const cloneChildrenWithProps = (
    children: React.ReactNode,
    props: Record<string, unknown>,
  ): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        const newProps = { ...props };
        // Also clone nested children
        if (child.props.children) {
          newProps.children = cloneChildrenWithProps(child.props.children, props);
        }
        return React.cloneElement(child, newProps);
      }
      return child;
    });
  };

  const TabsImpl = ({
    children,
    value,
    onValueChange,
  }: {
    children?: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => {
    const [currentTab, setCurrentTab] = React.useState(value);

    React.useEffect(() => {
      setCurrentTab(value);
    }, [value]);

    const handleTabChange = (newValue: string) => {
      setCurrentTab(newValue);
      onValueChange?.(newValue);
    };

    const childrenWithProps = cloneChildrenWithProps(children, {
      currentTab,
      onTabChange: handleTabChange,
    });

    return (
      <div data-testid="tabs" data-value={currentTab}>
        {childrenWithProps}
      </div>
    );
  };

  return {
    Tabs: TabsImpl,
    TabsList: ({
      children,
      currentTab,
      onTabChange,
    }: {
      children?: React.ReactNode;
      currentTab?: string;
      onTabChange?: (v: string) => void;
    }) => (
      <div data-testid="tabs-list">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { currentTab, onTabChange } as Record<
              string,
              unknown
            >);
          }
          return child;
        })}
      </div>
    ),
    TabsTrigger: ({
      children,
      value,
      currentTab: _currentTab,
      onTabChange,
    }: {
      children?: React.ReactNode;
      value?: string;
      currentTab?: string;
      onTabChange?: (v: string) => void;
    }) => (
      <button data-testid={`tab-trigger-${value}`} onClick={() => onTabChange?.(value)}>
        {children}
      </button>
    ),
    TabsContent: ({
      children,
      value,
      currentTab,
    }: {
      children?: React.ReactNode;
      value?: string;
      currentTab?: string;
    }) =>
      currentTab === value ? <div data-testid={`tab-content-${value}`}>{children}</div> : null,
  };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children?: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

const mockComparisonResult = {
  file1: {
    path: '/test/file1.txt',
    name: 'file1.txt',
    size: 1024,
    modified: 1640995200, // 2022-01-01
    hash: 'abc123',
  },
  file2: {
    path: '/test/file2.txt',
    name: 'file2.txt',
    size: 2048,
    modified: 1641081600, // 2022-01-02
    hash: 'def456',
  },
  differences: [
    {
      type: 'added',
      line2: 5,
      content2: 'This is a new line',
      severity: 'medium',
    },
    {
      type: 'modified',
      line1: 10,
      line2: 10,
      content1: 'Old content',
      content2: 'New content',
      severity: 'medium',
    },
  ],
  identical: false,
  similarity: 0.85,
  comparisonType: 'text',
  metadata: {
    processingTime: 150,
    linesAdded: 1,
    linesRemoved: 0,
    linesModified: 1,
    totalLines1: 20,
    totalLines2: 21,
    bytesDifferent: 1024,
    algorithm: 'myers',
  },
};

describe('FileComparisonDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(FileComparison.compareFiles).mockResolvedValue(mockComparisonResult);
  });

  it('renders correctly when closed', () => {
    render(
      <FileComparisonDialog
        isOpen={false}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
      />,
    );

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders correctly when open', async () => {
    await act(async () => {
      render(
        <FileComparisonDialog
          isOpen={true}
          onClose={mockOnClose}
          file1Path="/test/file1.txt"
          file2Path="/test/file2.txt"
          onError={mockOnError}
        />,
      );
    });

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('File Comparison');
    expect(screen.getByTestId('scale-icon')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    // Make the mock take some time to resolve
    vi.mocked(FileComparison.compareFiles).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockComparisonResult), 100)),
    );

    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
      />,
    );

    // Check for loading state before the promise resolves
    expect(screen.getByText('Comparing files...')).toBeInTheDocument();

    // Wait for comparison to complete
    await waitFor(() => {
      expect(screen.queryByText('Comparing files...')).not.toBeInTheDocument();
    });
  });

  it('displays comparison results after loading', async () => {
    // Reset mock to default behavior
    vi.mocked(FileComparison.compareFiles).mockResolvedValue(mockComparisonResult);

    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(FileComparison.compareFiles).toHaveBeenCalledWith(
        '/test/file1.txt',
        '/test/file2.txt',
        expect.any(Object),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Files differ')).toBeInTheDocument();
      expect(screen.getByText('85.0% similar')).toBeInTheDocument();
      expect(screen.getByText('text comparison')).toBeInTheDocument();
    });
  });

  it('displays file information', async () => {
    // Reset mock to default behavior
    vi.mocked(FileComparison.compareFiles).mockResolvedValue(mockComparisonResult);

    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('file1.txt').length).toBeGreaterThan(0);
      expect(screen.getAllByText('file2.txt').length).toBeGreaterThan(0);
      expect(screen.getByText('Size: 1.0 KB')).toBeInTheDocument();
      expect(screen.getByText('Size: 2.0 KB')).toBeInTheDocument();
    });
  });

  it('displays comparison statistics', async () => {
    // Reset mock to default behavior
    vi.mocked(FileComparison.compareFiles).mockResolvedValue(mockComparisonResult);

    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Lines Added')).toBeInTheDocument();
      expect(screen.getByText('Lines Removed')).toBeInTheDocument();
      expect(screen.getByText('Lines Modified')).toBeInTheDocument();
      // Check the values are present (but don't use getByText since there are duplicates)
      const statsElements = screen.getAllByText(/^[0-9]+$/);
      expect(statsElements.length).toBeGreaterThan(0);
    });
  });

  it('shows differences in the differences tab', async () => {
    // Reset mock to default behavior
    vi.mocked(FileComparison.compareFiles).mockResolvedValue(mockComparisonResult);

    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-trigger-differences')).toHaveTextContent('Differences (2)');
    });

    // Click on differences tab
    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-trigger-differences'));
    });

    await waitFor(() => {
      expect(screen.getByText('+ This is a new line')).toBeInTheDocument();
      expect(screen.getByText('- Old content')).toBeInTheDocument();
      expect(screen.getByText('+ New content')).toBeInTheDocument();
    });
  });

  it('handles comparison errors', async () => {
    const error = new Error('Comparison failed');
    vi.mocked(FileComparison.compareFiles).mockRejectedValue(error);

    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Comparison failed');
    });
  });

  it('calls onClose when close button is clicked', async () => {
    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    const closeButton = screen.getByTestId('x-icon').closest('button');
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('shows refresh button when comparison is loaded', async () => {
    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Refresh Comparison')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Refresh Comparison'));

    expect(FileComparison.compareFiles).toHaveBeenCalledTimes(2);
  });

  it('shows identical files message', async () => {
    const identicalResult = {
      ...mockComparisonResult,
      identical: true,
      similarity: 1.0,
      differences: [],
    };
    vi.mocked(FileComparison.compareFiles).mockResolvedValue(identicalResult);

    render(
      <FileComparisonDialog
        isOpen={true}
        onClose={mockOnClose}
        file1Path="/test/file1.txt"
        file2Path="/test/file2.txt"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Files are identical')).toBeInTheDocument();
      expect(screen.getByText('100.0% similar')).toBeInTheDocument();
    });
  });
});
