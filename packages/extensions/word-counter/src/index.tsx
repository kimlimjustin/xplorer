/**
 * Word Counter Extension
 *
 * Demonstrates: Command.register() with keyboard shortcut, file reading,
 * UI notifications, useSelectedFiles hook.
 *
 * Usage: Select a text file, then press Ctrl+Shift+W or run the "Count Words" command.
 */

import { Command, useSelectedFiles, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Constants ───────────────────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'rst', 'log', 'csv', 'tsv',
  'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'py', 'rb', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1',
  'sql', 'graphql', 'gql',
  'env', 'gitignore', 'dockerignore', 'editorconfig',
  'vue', 'svelte', 'astro',
]);

function isTextFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return TEXT_EXTENSIONS.has(ext) || !filename.includes('.');
}

function countStats(content: string) {
  const lines = content.split('\n').length;
  const characters = content.length;
  const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
  const paragraphs = content.trim() === '' ? 0 : content.split(/\n\s*\n/).filter(p => p.trim()).length;
  return { words, lines, characters, paragraphs };
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ── Registration ────────────────────────────────────────────────────────────

Command.register({
  id: 'xplorer-word-counter.count',
  title: 'Count Words in File',
  shortcut: 'ctrl+shift+w',
  permissions: ['file:read', 'ui:notifications'],
  action: async (api: XplorerAPI) => {
    const state = (window as Record<string, unknown>).__xplorer_state__ as
      { selectedFiles?: Array<{ name: string; path: string; is_dir: boolean }> } | undefined;
    const selectedFiles = state?.selectedFiles || [];

    const targetPath = selectedFiles.length > 0 ? selectedFiles[0].path : null;

    if (!targetPath) {
      api.ui.showMessage('No file selected. Select a text file first.', 'warning');
      return;
    }

    const filename = targetPath.split(/[/\\]/).pop() || '';
    if (!isTextFile(filename)) {
      api.ui.showMessage(`"${filename}" doesn't appear to be a text file.`, 'warning');
      return;
    }

    try {
      const content = await api.files.readText(targetPath);
      const stats = countStats(content);

      const message = [
        `📄 ${filename}`,
        `Words: ${formatNumber(stats.words)}`,
        `Lines: ${formatNumber(stats.lines)}`,
        `Characters: ${formatNumber(stats.characters)}`,
        `Paragraphs: ${formatNumber(stats.paragraphs)}`,
      ].join(' · ');

      api.ui.showMessage(message, 'info');

      await api.settings.set('lastCount', {
        file: targetPath,
        ...stats,
        timestamp: Date.now(),
      });
    } catch (err) {
      api.ui.showMessage(`Failed to read file: ${err}`, 'error');
    }
  },
});
