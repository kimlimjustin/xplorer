import { useCallback } from 'react';
import { useDialogs, type DialogState, type PasswordPromptData } from '@/hooks/use-dialogs';
import type { TabItem } from '@/types/split-view';

// ── Types ────────────────────────────────────────────────────────────────────

interface UseDialogManagerDeps {
  splitLayout: {
    addTab: (groupId: string, tab: TabItem, activate: boolean) => void;
  };
  activeGroupId: string;
  fileComparison: {
    closeSelectionDialog: () => void;
  };
  refetch: () => void;
}

export interface DialogManagerResult extends DialogState {
  handlePasswordPromptSubmit: (password: string, remember: boolean) => Promise<void>;
  handlePasswordPromptClose: () => void;
  handleComparisonFromDialog: (file1Path: string, file2Path: string) => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useDialogManager = (deps: UseDialogManagerDeps): DialogManagerResult => {
  const { splitLayout, activeGroupId, fileComparison, refetch: _refetch } = deps;
  const dialogs = useDialogs();

  const handlePasswordPromptSubmit = useCallback(
    async (password: string, _remember: boolean) => {
      if (dialogs.passwordPromptData?.onSuccess) {
        await dialogs.passwordPromptData.onSuccess(password);
      }
      dialogs.closePasswordPrompt();
    },
    [dialogs],
  );

  const handlePasswordPromptClose = useCallback(() => {
    dialogs.closePasswordPrompt();
  }, [dialogs]);

  const handleComparisonFromDialog = useCallback(
    (file1Path: string, file2Path: string) => {
      const file1Name = file1Path.split(/[/\\]/).pop() || 'file1';
      const file2Name = file2Path.split(/[/\\]/).pop() || 'file2';

      const comparisonTab: TabItem = {
        id: `comparison-${Date.now()}`,
        name: `${file1Name} \u2194 ${file2Name}`,
        path: `comparison://${file1Path}|${file2Path}`,
        type: 'comparison',
        comparisonData: { file1Path, file2Path },
      };

      splitLayout.addTab(activeGroupId, comparisonTab, true);
      fileComparison.closeSelectionDialog();
    },
    [splitLayout, activeGroupId, fileComparison],
  );

  return {
    ...dialogs,
    handlePasswordPromptSubmit,
    handlePasswordPromptClose,
    handleComparisonFromDialog,
  };
};

export type { PasswordPromptData };
