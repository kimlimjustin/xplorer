import { useTranslation } from 'react-i18next';
import useUpdater from '@/hooks/use-updater';

const UpdateBanner = () => {
  const { t } = useTranslation();
  const { status, installUpdate, dismissUpdate } = useUpdater();

  if (!status.available || status.error) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2 text-sm"
      style={{
        backgroundColor: 'var(--xp-accent, #4f46e5)',
        color: 'white',
      }}
    >
      {status.downloading ? (
        <div className="flex flex-1 items-center gap-3">
          <span>{t('updater.downloading')}</span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${status.progress}%`,
                backgroundColor: 'white',
              }}
            />
          </div>
          <span>{Math.round(status.progress)}%</span>
        </div>
      ) : (
        <>
          <span>{t('updater.available', { version: status.version })}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={installUpdate}
              className="rounded px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
              }}
            >
              {t('updater.install')}
            </button>
            <button
              onClick={dismissUpdate}
              className="rounded px-2 py-1 text-xs opacity-70 hover:opacity-100"
            >
              {t('updater.dismiss')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UpdateBanner;
