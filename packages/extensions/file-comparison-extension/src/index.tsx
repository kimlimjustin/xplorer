/**
 * File Comparison Extension
 *
 * Registers a command that triggers file comparison via the host app.
 * The actual comparison UI is still rendered by the host (FileComparisonDialog).
 * This extension exposes the command so it can be invoked from context menus
 * and keyboard shortcuts.
 */
import { Command } from '@xplorer/extension-sdk';

Command.register({
  id: 'file-comparison.compare',
  title: 'Compare Files',
  shortcut: 'ctrl+shift+d',
  permissions: ['file:read'],
  action: async (api) => {
    const path = api.navigation.getCurrentPath();
    if (!path) {
      api.ui.showMessage('No file selected for comparison', 'warning');
      return;
    }
    // Dispatch event to host for comparison dialog
    window.dispatchEvent(new CustomEvent('xplorer-compare-files', {
      detail: { path },
    }));
  },
});
