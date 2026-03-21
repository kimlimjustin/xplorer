/**
 * Shared keyboard shortcut utilities.
 * Used by both the `useShortcuts` hook and the KeyboardShortcutsSettings UI.
 */

/** Normalize a KeyboardEvent into a string like "ctrl+shift+b" */
export const getKeyString = (event: KeyboardEvent): string => {
  const parts: string[] = [];

  if (event.ctrlKey || event.metaKey) {
    parts.push('ctrl');
  }
  if (event.altKey) {
    parts.push('alt');
  }
  if (event.shiftKey) {
    parts.push('shift');
  }

  let key = event.key.toLowerCase();

  switch (key) {
    case ' ':
      key = 'space';
      break;
    case 'arrowup':
      key = 'up';
      break;
    case 'arrowdown':
      key = 'down';
      break;
    case 'arrowleft':
      key = 'left';
      break;
    case 'arrowright':
      key = 'right';
      break;
    case 'escape':
      key = 'esc';
      break;
    case 'enter':
      key = 'enter';
      break;
    case 'backspace':
      key = 'backspace';
      break;
    case 'delete':
      key = 'del';
      break;
  }

  // Skip lone modifier keys
  if (['control', 'alt', 'shift', 'meta'].includes(key)) {
    return parts.join('+');
  }

  parts.push(key);
  return parts.join('+');
};

/** Convert "ctrl+shift+b" to "Ctrl + Shift + B" for display */
export const formatKeyComboForDisplay = (keyCombination: string): string => {
  if (!keyCombination) return '';
  return keyCombination
    .split('+')
    .map((part) => {
      switch (part) {
        case 'ctrl':
          return 'Ctrl';
        case 'alt':
          return 'Alt';
        case 'shift':
          return 'Shift';
        case 'meta':
          return 'Meta';
        case 'esc':
          return 'Esc';
        case 'del':
          return 'Del';
        case 'enter':
          return 'Enter';
        case 'space':
          return 'Space';
        case 'backspace':
          return 'Backspace';
        case 'tab':
          return 'Tab';
        case 'up':
          return '\u2191';
        case 'down':
          return '\u2193';
        case 'left':
          return '\u2190';
        case 'right':
          return '\u2192';
        default:
          // Function keys (f1-f12) and single chars
          if (part.startsWith('f') && !isNaN(Number(part.slice(1)))) return part.toUpperCase();
          return part.length === 1 ? part.toUpperCase() : part;
      }
    })
    .join(' + ');
};

/** Map action string → category id */
export const ACTION_CATEGORIES: Record<string, string> = {
  Copy: 'file-operations',
  Cut: 'file-operations',
  Paste: 'file-operations',
  Delete: 'file-operations',
  Rename: 'file-operations',
  NewFile: 'file-operations',
  NewFolder: 'file-operations',
  Duplicate: 'file-operations',

  NavigateUp: 'navigation',
  NavigateBack: 'navigation',
  NavigateForward: 'navigation',
  GoHome: 'navigation',
  GoToPath: 'navigation',

  SelectAll: 'selection',
  ClearSelection: 'selection',
  InvertSelection: 'selection',

  Search: 'search',
  QuickSearch: 'search',
  NaturalLanguageSearch: 'search',
  FilterFiles: 'search',

  Refresh: 'view',
  ToggleHiddenFiles: 'view',
  TogglePreview: 'view',
  ToggleLeftSidebar: 'view',
  ToggleRightSidebar: 'view',
  ToggleBottomPanel: 'view',
  SwitchViewMode: 'view',
  ZoomIn: 'view',
  ZoomOut: 'view',

  OpenSettings: 'application',
  ToggleFullscreen: 'application',
  Quit: 'application',
  NewWindow: 'application',
  CloseTab: 'application',
  NextTab: 'application',
  PreviousTab: 'application',

  OpenTerminal: 'terminal',
  OpenAIAssistant: 'terminal',
  OpenExtensions: 'terminal',
};

/** Human-readable labels for each action */
export const ACTION_LABELS: Record<string, string> = {
  Copy: 'Copy',
  Cut: 'Cut',
  Paste: 'Paste',
  Delete: 'Delete',
  Rename: 'Rename',
  NewFile: 'New File',
  NewFolder: 'New Folder',
  Duplicate: 'Duplicate',

  NavigateUp: 'Go to Parent',
  NavigateBack: 'Go Back',
  NavigateForward: 'Go Forward',
  GoHome: 'Go Home',
  GoToPath: 'Go to Path',

  SelectAll: 'Select All',
  ClearSelection: 'Clear Selection',
  InvertSelection: 'Invert Selection',

  Search: 'Search',
  QuickSearch: 'Quick Search',
  NaturalLanguageSearch: 'AI Search',
  FilterFiles: 'Filter Files',

  Refresh: 'Refresh',
  ToggleHiddenFiles: 'Toggle Hidden Files',
  TogglePreview: 'Toggle Preview',
  ToggleLeftSidebar: 'Toggle Left Sidebar',
  ToggleRightSidebar: 'Toggle Right Sidebar',
  ToggleBottomPanel: 'Toggle Bottom Panel',
  SwitchViewMode: 'Switch View Mode',
  ZoomIn: 'Zoom In',
  ZoomOut: 'Zoom Out',

  OpenSettings: 'Open Settings',
  ToggleFullscreen: 'Toggle Fullscreen',
  Quit: 'Quit',
  NewWindow: 'New Window',
  CloseTab: 'Close Tab',
  NextTab: 'Next Tab',
  PreviousTab: 'Previous Tab',

  OpenTerminal: 'Open Terminal',
  OpenAIAssistant: 'AI Assistant',
  OpenExtensions: 'Extensions',
};

/** Get category for a ShortcutAction (handles both string and object ExtensionAction) */
export const getCategoryForAction = (action: string | Record<string, unknown>): string => {
  if (typeof action !== 'string') return 'extensions';
  return ACTION_CATEGORIES[action] || 'other';
};

/** Get display label for a ShortcutAction */
export const getLabelForAction = (action: string | Record<string, unknown>): string => {
  if (typeof action !== 'string') {
    if ('ExtensionAction' in action) {
      const ea = action.ExtensionAction as { extension_id: string; action_id: string };
      return `Extension: ${ea.extension_id} / ${ea.action_id}`;
    }
    return String(action);
  }
  return ACTION_LABELS[action] || action;
};
