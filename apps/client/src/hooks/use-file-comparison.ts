import { useState, useCallback } from 'react';
import { FileEntry } from '@/lib/tauri-api';
import { useToast } from '@/hooks/use-toast';

export interface ComparisonState {
  markedFile: FileEntry | null;
  comparisonDialogOpen: boolean;
  selectionDialogOpen: boolean;
  file1Path: string;
  file2Path: string;
}

export const useFileComparison = () => {
  const [state, setState] = useState<ComparisonState>({
    markedFile: null,
    comparisonDialogOpen: false,
    selectionDialogOpen: false,
    file1Path: '',
    file2Path: '',
  });

  const { toast } = useToast();

  // Mark a file for comparison
  const markFileForComparison = useCallback(
    (file: FileEntry) => {
      setState((prev) => ({
        ...prev,
        markedFile: file,
      }));

      toast({
        title: 'File marked for comparison',
        description: `${file.name} is ready to compare`,
      });
    },
    [toast],
  );

  // Clear the marked file
  const clearComparisonMark = useCallback(() => {
    setState((prev) => ({
      ...prev,
      markedFile: null,
    }));
  }, []);

  // Open comparison dialog with two specific files
  const compareFiles = useCallback((file1: FileEntry, file2?: FileEntry) => {
    if (file2) {
      // Direct comparison of two files
      setState((prev) => ({
        ...prev,
        file1Path: file1.path,
        file2Path: file2.path,
        comparisonDialogOpen: true,
      }));
    } else {
      // Open selection dialog with file1 pre-filled
      setState((prev) => ({
        ...prev,
        file1Path: file1.path,
        file2Path: '',
        selectionDialogOpen: true,
      }));
    }
  }, []);

  // Handle comparison from selection dialog
  const handleCompareFromSelection = useCallback((file1Path: string, file2Path: string) => {
    setState((prev) => ({
      ...prev,
      file1Path,
      file2Path,
      selectionDialogOpen: false,
      comparisonDialogOpen: true,
    }));
  }, []);

  // Close comparison dialog
  const closeComparisonDialog = useCallback(() => {
    setState((prev) => ({
      ...prev,
      comparisonDialogOpen: false,
      file1Path: '',
      file2Path: '',
    }));
  }, []);

  // Close selection dialog
  const closeSelectionDialog = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectionDialogOpen: false,
      file1Path: '',
      file2Path: '',
    }));
  }, []);

  // Handle comparison error
  const handleComparisonError = useCallback(
    (error: string) => {
      toast({
        title: 'Comparison Error',
        description: error,
        variant: 'destructive',
      });
    },
    [toast],
  );

  // Open file selection dialog for comparison
  const openComparisonSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      file1Path: '',
      file2Path: '',
      selectionDialogOpen: true,
    }));
  }, []);

  return {
    // State
    markedFile: state.markedFile,
    comparisonDialogOpen: state.comparisonDialogOpen,
    selectionDialogOpen: state.selectionDialogOpen,
    file1Path: state.file1Path,
    file2Path: state.file2Path,

    // Actions
    markFileForComparison,
    clearComparisonMark,
    compareFiles,
    handleCompareFromSelection,
    closeComparisonDialog,
    closeSelectionDialog,
    handleComparisonError,
    openComparisonSelection,
  };
}
