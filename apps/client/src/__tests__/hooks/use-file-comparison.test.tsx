// React is used by JSX transform
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFileComparison } from '@/hooks/use-file-comparison';
import { useToast } from '@/hooks/use-toast';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

const mockToast = vi.fn();

describe('useFileComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as unknown).mockReturnValue({ toast: mockToast });
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useFileComparison());

    expect(result.current.markedFile).toBeNull();
    expect(result.current.comparisonDialogOpen).toBe(false);
    expect(result.current.selectionDialogOpen).toBe(false);
    expect(result.current.file1Path).toBe('');
    expect(result.current.file2Path).toBe('');
  });

  it('marks a file for comparison', () => {
    const { result } = renderHook(() => useFileComparison());
    const mockFile = {
      name: 'test.txt',
      path: '/test/test.txt',
      is_dir: false,
      size: 1024,
      modified: 1640995200,
      file_type: 'text',
    };

    act(() => {
      result.current.markFileForComparison(mockFile);
    });

    expect(result.current.markedFile).toEqual(mockFile);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'File marked for comparison',
      description: 'test.txt is ready to compare',
    });
  });

  it('clears the comparison mark', () => {
    const { result } = renderHook(() => useFileComparison());
    const mockFile = {
      name: 'test.txt',
      path: '/test/test.txt',
      is_dir: false,
      size: 1024,
      modified: 1640995200,
      file_type: 'text',
    };

    act(() => {
      result.current.markFileForComparison(mockFile);
    });

    expect(result.current.markedFile).toEqual(mockFile);

    act(() => {
      result.current.clearComparisonMark();
    });

    expect(result.current.markedFile).toBeNull();
  });

  it('compares files directly when two files provided', () => {
    const { result } = renderHook(() => useFileComparison());
    const mockFile1 = {
      name: 'file1.txt',
      path: '/test/file1.txt',
      is_dir: false,
      size: 1024,
      modified: 1640995200,
      file_type: 'text',
    };
    const mockFile2 = {
      name: 'file2.txt',
      path: '/test/file2.txt',
      is_dir: false,
      size: 2048,
      modified: 1641081600,
      file_type: 'text',
    };

    act(() => {
      result.current.compareFiles(mockFile1, mockFile2);
    });

    expect(result.current.comparisonDialogOpen).toBe(true);
    expect(result.current.file1Path).toBe('/test/file1.txt');
    expect(result.current.file2Path).toBe('/test/file2.txt');
    expect(result.current.selectionDialogOpen).toBe(false);
  });

  it('opens selection dialog when only one file provided', () => {
    const { result } = renderHook(() => useFileComparison());
    const mockFile1 = {
      name: 'file1.txt',
      path: '/test/file1.txt',
      is_dir: false,
      size: 1024,
      modified: 1640995200,
      file_type: 'text',
    };

    act(() => {
      result.current.compareFiles(mockFile1);
    });

    expect(result.current.selectionDialogOpen).toBe(true);
    expect(result.current.file1Path).toBe('/test/file1.txt');
    expect(result.current.file2Path).toBe('');
    expect(result.current.comparisonDialogOpen).toBe(false);
  });

  it('handles comparison from selection dialog', () => {
    const { result } = renderHook(() => useFileComparison());

    act(() => {
      result.current.handleCompareFromSelection('/test/file1.txt', '/test/file2.txt');
    });

    expect(result.current.comparisonDialogOpen).toBe(true);
    expect(result.current.selectionDialogOpen).toBe(false);
    expect(result.current.file1Path).toBe('/test/file1.txt');
    expect(result.current.file2Path).toBe('/test/file2.txt');
  });

  it('closes comparison dialog', () => {
    const { result } = renderHook(() => useFileComparison());

    // First open the dialog
    act(() => {
      result.current.handleCompareFromSelection('/test/file1.txt', '/test/file2.txt');
    });

    expect(result.current.comparisonDialogOpen).toBe(true);

    // Then close it
    act(() => {
      result.current.closeComparisonDialog();
    });

    expect(result.current.comparisonDialogOpen).toBe(false);
    expect(result.current.file1Path).toBe('');
    expect(result.current.file2Path).toBe('');
  });

  it('closes selection dialog', () => {
    const { result } = renderHook(() => useFileComparison());
    const mockFile1 = {
      name: 'file1.txt',
      path: '/test/file1.txt',
      is_dir: false,
      size: 1024,
      modified: 1640995200,
      file_type: 'text',
    };

    // First open the selection dialog
    act(() => {
      result.current.compareFiles(mockFile1);
    });

    expect(result.current.selectionDialogOpen).toBe(true);

    // Then close it
    act(() => {
      result.current.closeSelectionDialog();
    });

    expect(result.current.selectionDialogOpen).toBe(false);
    expect(result.current.file1Path).toBe('');
    expect(result.current.file2Path).toBe('');
  });

  it('handles comparison errors', () => {
    const { result } = renderHook(() => useFileComparison());
    const errorMessage = 'Comparison failed due to file access error';

    act(() => {
      result.current.handleComparisonError(errorMessage);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Comparison Error',
      description: errorMessage,
      variant: 'destructive',
    });
  });

  it('opens comparison selection dialog', () => {
    const { result } = renderHook(() => useFileComparison());

    act(() => {
      result.current.openComparisonSelection();
    });

    expect(result.current.selectionDialogOpen).toBe(true);
    expect(result.current.file1Path).toBe('');
    expect(result.current.file2Path).toBe('');
    expect(result.current.comparisonDialogOpen).toBe(false);
  });

  it('maintains state consistency through multiple operations', () => {
    const { result } = renderHook(() => useFileComparison());
    const mockFile = {
      name: 'test.txt',
      path: '/test/test.txt',
      is_dir: false,
      size: 1024,
      modified: 1640995200,
      file_type: 'text',
    };

    // Mark file for comparison
    act(() => {
      result.current.markFileForComparison(mockFile);
    });

    expect(result.current.markedFile).toEqual(mockFile);

    // Open selection dialog
    act(() => {
      result.current.openComparisonSelection();
    });

    expect(result.current.selectionDialogOpen).toBe(true);
    expect(result.current.markedFile).toEqual(mockFile); // Should still be marked

    // Handle comparison from selection
    act(() => {
      result.current.handleCompareFromSelection('/test/file1.txt', '/test/file2.txt');
    });

    expect(result.current.comparisonDialogOpen).toBe(true);
    expect(result.current.selectionDialogOpen).toBe(false);
    expect(result.current.markedFile).toEqual(mockFile); // Should still be marked

    // Close comparison dialog
    act(() => {
      result.current.closeComparisonDialog();
    });

    expect(result.current.comparisonDialogOpen).toBe(false);
    expect(result.current.markedFile).toEqual(mockFile); // Should still be marked

    // Clear comparison mark
    act(() => {
      result.current.clearComparisonMark();
    });

    expect(result.current.markedFile).toBeNull();
  });
});
