import { useTranslation } from 'react-i18next';
import { FileCode, Trash2 } from 'lucide-react';
import { useOpenWithPrefs, type OpenHandler } from '@/hooks/use-open-with-prefs';
import { SectionTitle, Divider } from './shared';

const HANDLER_LABELS: Record<OpenHandler, string> = {
  'xplorer-editor': 'openWith.xplorerEditor',
  vscode: 'openWith.vscode',
  system: 'openWith.systemDefault',
};

const FileAssociationsSettings = () => {
  const { t } = useTranslation();
  const { prefs, clearPreference, clearAll } = useOpenWithPrefs();

  const entries = Object.entries(prefs);

  return (
    <div className="space-y-1">
      <SectionTitle title={t('settings.fileAssociations.title')} />
      <p className="text-xp-text-secondary px-4 pb-2 text-xs">
        {t('settings.fileAssociations.description')}
      </p>

      {entries.length === 0 ? (
        <div className="text-xp-text-secondary px-4 py-6 text-center text-sm">
          {t('settings.fileAssociations.noPreferences')}
        </div>
      ) : (
        <>
          <div className="space-y-1 px-2">
            {entries.map(([ext, handler]) => (
              <div
                key={ext}
                className="hover:bg-xp-surface-light/50 flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileCode size={16} className="text-xp-text-secondary shrink-0" />
                  <div>
                    <span className="text-xp-text text-sm font-medium">.{ext}</span>
                    <span className="text-xp-text-secondary ml-2 text-xs">
                      → {t(HANDLER_LABELS[handler])}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => clearPreference(ext)}
                  className="text-xp-text-secondary rounded-md p-1.5 transition-colors hover:text-red-400"
                  title={t('settings.fileAssociations.reset')}
                  aria-label={t('settings.fileAssociations.resetExt', { ext })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <Divider />

          <div className="px-4 py-2">
            <button
              onClick={clearAll}
              className="text-xp-text-secondary text-sm transition-colors hover:text-red-400"
            >
              {t('settings.fileAssociations.resetAll')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FileAssociationsSettings;
