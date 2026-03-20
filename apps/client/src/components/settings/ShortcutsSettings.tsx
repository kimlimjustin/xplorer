import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import KeyboardShortcutsSettings from '@/components/KeyboardShortcutsSettings';
import { isVimModeEnabled, setVimModeSetting } from '@/hooks/use-vim-mode';
import { Toggle, SettingRow, SectionTitle, Divider } from './shared';

const ShortcutsSettingsPanel = () => {
  const [vimModeEnabled, setVimModeEnabledState] = useState(() => isVimModeEnabled());

  const handleVimModeToggle = (v: boolean) => {
    setVimModeEnabledState(v);
    setVimModeSetting(v);
  };

  return (
    <div className="space-y-1">
      <SectionTitle title="Input Mode" />
      <SettingRow
        icon={Keyboard}
        label="Vim Mode"
        description="Navigate files with vim-like keys (j/k/h/l, gg, G, dd, yy, p, v)"
      >
        <Toggle id="vimMode" checked={vimModeEnabled} onChange={handleVimModeToggle} />
      </SettingRow>
      {vimModeEnabled && (
        <div className="mx-4 mb-2 rounded-md bg-xp-surface-light/50 p-3 text-xs text-xp-text-secondary leading-relaxed space-y-1">
          <div className="font-medium text-xp-text text-sm mb-1.5">Vim Key Bindings</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">j</kbd> /{' '}
              <kbd className="font-mono bg-xp-bg px-1 rounded">k</kbd> Move down / up
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">h</kbd> Go to parent
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">l</kbd> /{' '}
              <kbd className="font-mono bg-xp-bg px-1 rounded">Enter</kbd> Open / enter
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">gg</kbd> First file
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">G</kbd> Last file
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">/</kbd> Focus search
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">dd</kbd> Delete
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">yy</kbd> Copy (yank)
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">p</kbd> Paste
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">v</kbd> Visual mode
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">V</kbd> Select range
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">o</kbd> Open with default
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">r</kbd> Rename
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">m</kbd> Bookmark dir
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">.</kbd> Repeat last
            </span>
            <span>
              <kbd className="font-mono bg-xp-bg px-1 rounded">Esc</kbd> Clear / exit
            </span>
          </div>
        </div>
      )}
      <Divider />
      <SectionTitle title="Key Bindings" />
      <div className="px-4 py-2">
        <KeyboardShortcutsSettings />
      </div>
    </div>
  );
}

export default ShortcutsSettingsPanel;
