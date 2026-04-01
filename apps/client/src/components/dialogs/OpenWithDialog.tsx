import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, Monitor, ExternalLink, X } from 'lucide-react';
import {
  type OpenHandler,
  getFileExtension,
  isCodeFile,
  setOpenPreference,
} from '@/hooks/use-open-with-prefs';

interface OpenWithDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  onChoose: (handler: OpenHandler) => void;
}

interface HandlerOption {
  id: OpenHandler;
  labelKey: string;
  descriptionKey: string;
  Icon: React.ElementType;
}

const HANDLER_OPTIONS: HandlerOption[] = [
  {
    id: 'xplorer-editor',
    labelKey: 'openWith.xplorerEditor',
    descriptionKey: 'openWith.xplorerEditorDesc',
    Icon: FileCode,
  },
  {
    id: 'vscode',
    labelKey: 'openWith.vscode',
    descriptionKey: 'openWith.vscodeDesc',
    Icon: ExternalLink,
  },
  {
    id: 'system',
    labelKey: 'openWith.systemDefault',
    descriptionKey: 'openWith.systemDefaultDesc',
    Icon: Monitor,
  },
];

const OpenWithDialog = ({ isOpen, onClose, filePath, onChoose }: OpenWithDialogProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<OpenHandler>('xplorer-editor');
  const [rememberChoice, setRememberChoice] = useState(false);

  const ext = getFileExtension(filePath);
  const fileName = filePath.split(/[/\\]/).pop() ?? '';
  const isCode = isCodeFile(filePath);

  const handleOpen = useCallback(() => {
    if (rememberChoice && ext) {
      setOpenPreference(ext, selected);
    }
    onChoose(selected);
    onClose();
  }, [rememberChoice, ext, selected, onChoose, onClose]);

  const handleClose = useCallback(() => {
    setSelected('xplorer-editor');
    setRememberChoice(false);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        handleOpen();
      }
    },
    [handleClose, handleOpen],
  );

  if (!isOpen) return null;

  // For non-code files, fall through — this dialog is code-file specific.
  // The caller should not open this for non-code files, but guard just in case.
  const options = isCode
    ? HANDLER_OPTIONS
    : HANDLER_OPTIONS.filter((o) => o.id !== 'xplorer-editor');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('openWith.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-xp-surface border-xp-border w-[420px] max-w-[90vw] overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-xp-border flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-xp-text text-base font-semibold">{t('openWith.title')}</h2>
            <p className="text-xp-text-secondary mt-0.5 max-w-[300px] truncate text-xs">
              {fileName}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-xp-text-secondary hover:bg-xp-surface-light hover:text-xp-text rounded-md p-1.5 transition-colors"
            aria-label={t('openWith.cancel')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-1.5 p-4">
          {options.map(({ id, labelKey, descriptionKey, Icon }) => {
            const isSelected = selected === id;
            return (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all ${
                  isSelected
                    ? 'bg-xp-accent/15 ring-xp-accent/40 ring-1'
                    : 'hover:bg-xp-surface-light'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isSelected
                      ? 'bg-xp-accent/20 text-xp-accent'
                      : 'bg-xp-bg text-xp-text-secondary'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium ${isSelected ? 'text-xp-accent' : 'text-xp-text'}`}
                  >
                    {t(labelKey)}
                  </div>
                  <div className="text-xp-text-secondary text-xs">{t(descriptionKey)}</div>
                </div>
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected ? 'border-xp-accent bg-xp-accent' : 'border-xp-border'
                  }`}
                >
                  {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Remember checkbox */}
        {ext && (
          <div className="border-xp-border border-t px-5 py-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                className="text-xp-accent bg-xp-bg border-xp-border focus:ring-xp-accent h-4 w-4 rounded focus:ring-2"
              />
              <span className="text-xp-text text-sm">{t('openWith.alwaysUse', { ext })}</span>
            </label>
          </div>
        )}

        {/* Footer */}
        <div className="border-xp-border flex justify-end gap-2 border-t px-5 py-3">
          <button
            onClick={handleClose}
            className="text-xp-text hover:bg-xp-surface-light rounded-md px-4 py-2 text-sm transition-colors"
          >
            {t('openWith.cancel')}
          </button>
          <button
            onClick={handleOpen}
            className="bg-xp-accent hover:bg-xp-accent/80 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {t('openWith.open')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenWithDialog;
