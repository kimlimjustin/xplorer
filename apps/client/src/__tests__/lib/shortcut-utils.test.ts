import { describe, it, expect } from 'vitest';
import {
  getKeyString,
  formatKeyComboForDisplay,
  ACTION_CATEGORIES,
  ACTION_LABELS,
  getCategoryForAction,
  getLabelForAction,
} from '@/lib/shortcut-utils';

// ── Helper to create a KeyboardEvent-like object ─────────────────────────

const makeKeyEvent = (overrides: Partial<KeyboardEvent> = {}): KeyboardEvent => {
  return {
    key: 'a',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  } as KeyboardEvent;
};

// ── getKeyString ──────────────────────────────────────────────────────────

describe('getKeyString', () => {
  it('returns just the key for unmodified key press', () => {
    expect(getKeyString(makeKeyEvent({ key: 'a' }))).toBe('a');
  });

  it('prepends ctrl for ctrl key', () => {
    expect(getKeyString(makeKeyEvent({ key: 'c', ctrlKey: true }))).toBe('ctrl+c');
  });

  it('prepends ctrl for meta key (Cmd on Mac)', () => {
    expect(getKeyString(makeKeyEvent({ key: 'c', metaKey: true }))).toBe('ctrl+c');
  });

  it('prepends alt for alt key', () => {
    expect(getKeyString(makeKeyEvent({ key: 'f', altKey: true }))).toBe('alt+f');
  });

  it('prepends shift for shift key', () => {
    expect(getKeyString(makeKeyEvent({ key: 'b', shiftKey: true }))).toBe('shift+b');
  });

  it('combines multiple modifiers in order ctrl+alt+shift', () => {
    expect(
      getKeyString(makeKeyEvent({ key: 'x', ctrlKey: true, altKey: true, shiftKey: true })),
    ).toBe('ctrl+alt+shift+x');
  });

  it('normalizes space key', () => {
    expect(getKeyString(makeKeyEvent({ key: ' ' }))).toBe('space');
  });

  it('normalizes arrow keys', () => {
    expect(getKeyString(makeKeyEvent({ key: 'ArrowUp' }))).toBe('up');
    expect(getKeyString(makeKeyEvent({ key: 'ArrowDown' }))).toBe('down');
    expect(getKeyString(makeKeyEvent({ key: 'ArrowLeft' }))).toBe('left');
    expect(getKeyString(makeKeyEvent({ key: 'ArrowRight' }))).toBe('right');
  });

  it('normalizes Escape to esc', () => {
    expect(getKeyString(makeKeyEvent({ key: 'Escape' }))).toBe('esc');
  });

  it('normalizes Delete to del', () => {
    expect(getKeyString(makeKeyEvent({ key: 'Delete' }))).toBe('del');
  });

  it('normalizes Backspace', () => {
    expect(getKeyString(makeKeyEvent({ key: 'Backspace' }))).toBe('backspace');
  });

  it('normalizes Enter', () => {
    expect(getKeyString(makeKeyEvent({ key: 'Enter' }))).toBe('enter');
  });

  it('handles function keys', () => {
    expect(getKeyString(makeKeyEvent({ key: 'F5' }))).toBe('f5');
  });

  it('skips lone modifier keys (returns only modifiers prefix)', () => {
    expect(getKeyString(makeKeyEvent({ key: 'Control', ctrlKey: true }))).toBe('ctrl');
    expect(getKeyString(makeKeyEvent({ key: 'Alt', altKey: true }))).toBe('alt');
    expect(getKeyString(makeKeyEvent({ key: 'Shift', shiftKey: true }))).toBe('shift');
    expect(getKeyString(makeKeyEvent({ key: 'Meta', metaKey: true }))).toBe('ctrl');
  });

  it('lowercases key names', () => {
    expect(getKeyString(makeKeyEvent({ key: 'A' }))).toBe('a');
    expect(getKeyString(makeKeyEvent({ key: 'Z', shiftKey: true }))).toBe('shift+z');
  });

  it('handles ctrl+shift+arrow combos', () => {
    expect(getKeyString(makeKeyEvent({ key: 'ArrowUp', ctrlKey: true, shiftKey: true }))).toBe(
      'ctrl+shift+up',
    );
  });
});

// ── formatKeyComboForDisplay ──────────────────────────────────────────────

describe('formatKeyComboForDisplay', () => {
  it('returns empty string for empty input', () => {
    expect(formatKeyComboForDisplay('')).toBe('');
  });

  it('formats ctrl modifier', () => {
    expect(formatKeyComboForDisplay('ctrl+c')).toBe('Ctrl + C');
  });

  it('formats alt modifier', () => {
    expect(formatKeyComboForDisplay('alt+f')).toBe('Alt + F');
  });

  it('formats shift modifier', () => {
    expect(formatKeyComboForDisplay('shift+a')).toBe('Shift + A');
  });

  it('formats combined modifiers', () => {
    expect(formatKeyComboForDisplay('ctrl+alt+shift+x')).toBe('Ctrl + Alt + Shift + X');
  });

  it('formats special key names', () => {
    expect(formatKeyComboForDisplay('esc')).toBe('Esc');
    expect(formatKeyComboForDisplay('del')).toBe('Del');
    expect(formatKeyComboForDisplay('enter')).toBe('Enter');
    expect(formatKeyComboForDisplay('space')).toBe('Space');
    expect(formatKeyComboForDisplay('backspace')).toBe('Backspace');
    expect(formatKeyComboForDisplay('tab')).toBe('Tab');
  });

  it('formats arrow keys as unicode symbols', () => {
    expect(formatKeyComboForDisplay('up')).toBe('\u2191');
    expect(formatKeyComboForDisplay('down')).toBe('\u2193');
    expect(formatKeyComboForDisplay('left')).toBe('\u2190');
    expect(formatKeyComboForDisplay('right')).toBe('\u2192');
  });

  it('formats function keys as uppercase', () => {
    expect(formatKeyComboForDisplay('f1')).toBe('F1');
    expect(formatKeyComboForDisplay('f12')).toBe('F12');
  });

  it('formats ctrl+shift+arrow combos', () => {
    expect(formatKeyComboForDisplay('ctrl+shift+up')).toBe('Ctrl + Shift + \u2191');
  });

  it('uppercases single character keys', () => {
    expect(formatKeyComboForDisplay('a')).toBe('A');
    expect(formatKeyComboForDisplay('z')).toBe('Z');
  });

  it('leaves multi-character non-special keys as-is', () => {
    expect(formatKeyComboForDisplay('home')).toBe('home');
  });
});

// ── ACTION_CATEGORIES ─────────────────────────────────────────────────────

describe('ACTION_CATEGORIES', () => {
  it('maps file operations to file-operations', () => {
    expect(ACTION_CATEGORIES.Copy).toBe('file-operations');
    expect(ACTION_CATEGORIES.Cut).toBe('file-operations');
    expect(ACTION_CATEGORIES.Paste).toBe('file-operations');
    expect(ACTION_CATEGORIES.Delete).toBe('file-operations');
    expect(ACTION_CATEGORIES.Rename).toBe('file-operations');
  });

  it('maps navigation actions to navigation', () => {
    expect(ACTION_CATEGORIES.NavigateUp).toBe('navigation');
    expect(ACTION_CATEGORIES.NavigateBack).toBe('navigation');
    expect(ACTION_CATEGORIES.GoHome).toBe('navigation');
  });

  it('maps view actions to view', () => {
    expect(ACTION_CATEGORIES.Refresh).toBe('view');
    expect(ACTION_CATEGORIES.ToggleHiddenFiles).toBe('view');
  });

  it('maps application actions to application', () => {
    expect(ACTION_CATEGORIES.OpenSettings).toBe('application');
    expect(ACTION_CATEGORIES.Quit).toBe('application');
  });

  it('maps terminal actions to terminal', () => {
    expect(ACTION_CATEGORIES.OpenTerminal).toBe('terminal');
  });
});

// ── ACTION_LABELS ─────────────────────────────────────────────────────────

describe('ACTION_LABELS', () => {
  it('has human-readable label for Copy', () => {
    expect(ACTION_LABELS.Copy).toBe('Copy');
  });

  it('has human-readable label for NavigateUp', () => {
    expect(ACTION_LABELS.NavigateUp).toBe('Go to Parent');
  });

  it('has human-readable label for NaturalLanguageSearch', () => {
    expect(ACTION_LABELS.NaturalLanguageSearch).toBe('AI Search');
  });

  it('has entries for all keys in ACTION_CATEGORIES', () => {
    for (const key of Object.keys(ACTION_CATEGORIES)) {
      expect(ACTION_LABELS).toHaveProperty(key);
    }
  });
});

// ── getCategoryForAction ──────────────────────────────────────────────────

describe('getCategoryForAction', () => {
  it('returns category for known string action', () => {
    expect(getCategoryForAction('Copy')).toBe('file-operations');
    expect(getCategoryForAction('Refresh')).toBe('view');
  });

  it('returns "other" for unknown string action', () => {
    expect(getCategoryForAction('UnknownAction')).toBe('other');
  });

  it('returns "extensions" for non-string (object) action', () => {
    expect(getCategoryForAction({ ExtensionAction: { extension_id: 'x', action_id: 'y' } })).toBe(
      'extensions',
    );
  });

  it('returns "extensions" for any object, not just ExtensionAction', () => {
    expect(getCategoryForAction({ something: 'else' })).toBe('extensions');
  });
});

// ── getLabelForAction ─────────────────────────────────────────────────────

describe('getLabelForAction', () => {
  it('returns label for known string action', () => {
    expect(getLabelForAction('Copy')).toBe('Copy');
    expect(getLabelForAction('GoHome')).toBe('Go Home');
  });

  it('returns the action string itself for unknown string action', () => {
    expect(getLabelForAction('CustomAction')).toBe('CustomAction');
  });

  it('formats ExtensionAction objects', () => {
    const action = { ExtensionAction: { extension_id: 'my-ext', action_id: 'do-thing' } };
    expect(getLabelForAction(action)).toBe('Extension: my-ext / do-thing');
  });

  it('stringifies non-ExtensionAction objects', () => {
    const action = { other: 'value' };
    expect(getLabelForAction(action)).toBe('[object Object]');
  });
});
