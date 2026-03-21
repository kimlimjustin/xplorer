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
        <div className="bg-xp-surface-light/50 text-xp-text-secondary mx-4 mb-2 space-y-1 rounded-md p-3 text-xs leading-relaxed">
          <div className="text-xp-text mb-1.5 text-sm font-medium">Vim Key Bindings</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">j</kbd> /{' '}
              <kbd className="bg-xp-bg rounded px-1 font-mono">k</kbd> Move down / up
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">h</kbd> Go to parent
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">l</kbd> /{' '}
              <kbd className="bg-xp-bg rounded px-1 font-mono">Enter</kbd> Open / enter
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">gg</kbd> First file
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">G</kbd> Last file
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">/</kbd> Focus search
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">dd</kbd> Delete
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">yy</kbd> Copy (yank)
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">p</kbd> Paste
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">v</kbd> Visual mode
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">V</kbd> Select range
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">o</kbd> Open with default
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">r</kbd> Rename
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">m</kbd> Bookmark dir
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">.</kbd> Repeat last
            </span>
            <span>
              <kbd className="bg-xp-bg rounded px-1 font-mono">Esc</kbd> Clear / exit
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
};

export default ShortcutsSettingsPanel;
