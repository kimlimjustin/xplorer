/**
 * JSON Formatter Extension
 *
 * Demonstrates: Command.register() for multiple commands, file reading/writing,
 * in-place file transformation, error handling.
 *
 * Usage: Right-click a .json file → "Format JSON" / "Minify JSON" / "Validate JSON"
 */

import { Command, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSelectedJsonFile(): { name: string; path: string } | null {
  const state = (window as Record<string, unknown>).__xplorer_state__ as
    { selectedFiles?: Array<{ name: string; path: string; is_dir: boolean }> } | undefined;
  const files = state?.selectedFiles || [];

  if (files.length === 0) return null;
  const file = files[0];
  if (file.is_dir) return null;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'json') return null;
  return file;
}

// ── Registration ────────────────────────────────────────────────────────────

Command.register({
  id: 'xplorer-json-formatter.format',
  title: 'Format JSON',
  permissions: ['file:read', 'file:write', 'ui:notifications'],
  action: async (api: XplorerAPI) => {
    const file = getSelectedJsonFile();
    if (!file) { api.ui.showMessage('Select a .json file first.', 'warning'); return; }

    try {
      const content = await api.files.readText(file.path);
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);

      if (formatted === content) {
        api.ui.showMessage(`"${file.name}" is already formatted.`, 'info');
        return;
      }

      await api.files.write(file.path, formatted);
      const savedBytes = content.length - formatted.length;
      const action = savedBytes > 0 ? `reduced by ${Math.abs(savedBytes)} chars` : `expanded by ${Math.abs(savedBytes)} chars`;
      api.ui.showMessage(`Formatted "${file.name}" (${action})`, 'info');
    } catch (err) {
      if (err instanceof SyntaxError) {
        api.ui.showMessage(`Invalid JSON in "${file.name}": ${err.message}`, 'error');
      } else {
        api.ui.showMessage(`Failed to format: ${err}`, 'error');
      }
    }
  },
});

Command.register({
  id: 'xplorer-json-formatter.minify',
  title: 'Minify JSON',
  permissions: ['file:read', 'file:write', 'ui:notifications'],
  action: async (api: XplorerAPI) => {
    const file = getSelectedJsonFile();
    if (!file) { api.ui.showMessage('Select a .json file first.', 'warning'); return; }

    try {
      const content = await api.files.readText(file.path);
      const parsed = JSON.parse(content);
      const minified = JSON.stringify(parsed);

      if (minified === content) {
        api.ui.showMessage(`"${file.name}" is already minified.`, 'info');
        return;
      }

      await api.files.write(file.path, minified);
      const savedBytes = content.length - minified.length;
      api.ui.showMessage(`Minified "${file.name}" (saved ${savedBytes} chars, ${Math.round(savedBytes / content.length * 100)}% smaller)`, 'info');
    } catch (err) {
      if (err instanceof SyntaxError) {
        api.ui.showMessage(`Invalid JSON in "${file.name}": ${err.message}`, 'error');
      } else {
        api.ui.showMessage(`Failed to minify: ${err}`, 'error');
      }
    }
  },
});

Command.register({
  id: 'xplorer-json-formatter.validate',
  title: 'Validate JSON',
  permissions: ['file:read', 'ui:notifications'],
  action: async (api: XplorerAPI) => {
    const file = getSelectedJsonFile();
    if (!file) { api.ui.showMessage('Select a .json file first.', 'warning'); return; }

    try {
      const content = await api.files.readText(file.path);
      JSON.parse(content);

      const keyCount = (content.match(/"[^"]+"\s*:/g) || []).length;
      const arrayCount = (content.match(/\[/g) || []).length;
      const objCount = (content.match(/\{/g) || []).length;

      api.ui.showMessage(
        `"${file.name}" is valid JSON — ${keyCount} keys, ${objCount} objects, ${arrayCount} arrays`,
        'info'
      );
    } catch (err) {
      if (err instanceof SyntaxError) {
        const posMatch = err.message.match(/position (\d+)/);
        const pos = posMatch ? parseInt(posMatch[1]) : null;
        let locationInfo = '';
        if (pos !== null) {
          try {
            const content = await api.files.readText(file.path);
            const lines = content.substring(0, pos).split('\n');
            locationInfo = ` at line ${lines.length}, column ${lines[lines.length - 1].length + 1}`;
          } catch { /* ignore */ }
        }
        api.ui.showMessage(`Invalid JSON in "${file.name}"${locationInfo}: ${err.message}`, 'error');
      } else {
        api.ui.showMessage(`Failed to validate: ${err}`, 'error');
      }
    }
  },
});
