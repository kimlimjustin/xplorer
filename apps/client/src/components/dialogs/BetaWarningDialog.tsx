import { useState, useEffect } from 'react';
import { AlertTriangle, Heart, X, ExternalLink } from 'lucide-react';

const BETA_DISMISSED_KEY = 'xplorer:beta-warning-dismissed';
const SPONSOR_URL = 'https://github.com/sponsors/kimlimjustin';

export const isBetaWarningDismissed = () : boolean => {
  return localStorage.getItem(BETA_DISMISSED_KEY) === 'true';
}

export const resetBetaWarning = () => {
  localStorage.removeItem(BETA_DISMISSED_KEY);
}

const BetaWarningDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isBetaWarningDismissed()) {
      const timer = setTimeout(() => setIsOpen(true), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isOpen) return null;

  const handleDismiss = () => {
    localStorage.setItem(BETA_DISMISSED_KEY, 'true');
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md mx-4 rounded-xl bg-xp-bg border border-xp-border shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-md text-xp-muted hover:text-xp-text hover:bg-xp-hover transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Warning header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-xp-text">Early Beta</h2>
              <p className="text-xs text-xp-muted">v0.1.0 — Preview Release</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-xp-muted leading-relaxed">
            <p>
              Welcome to <span className="font-medium text-xp-text">Xplorer</span>! This is an{' '}
              <span className="font-medium text-amber-500">early beta</span> release.
            </p>
            <ul className="space-y-1.5 ml-1">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                You may encounter bugs, crashes, or unexpected behavior
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Features may change or break between updates
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>
                  <span className="font-medium text-xp-text">Back up your files</span> — use this
                  app at your own risk
                </span>
              </li>
            </ul>
            <p className="text-xs">
              Found a bug? Report it on{' '}
              <a
                href="https://github.com/kimlimjustin/xplorer/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xp-blue hover:underline"
              >
                GitHub Issues
              </a>
              .
            </p>
          </div>
        </div>

        {/* Sponsor section */}
        <div className="mx-6 mb-4 rounded-lg bg-pink-500/5 border border-pink-500/20 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Heart className="h-4 w-4 text-pink-500" />
            <span className="text-sm font-medium text-xp-text">Support Development</span>
          </div>
          <p className="text-xs text-xp-muted mb-2.5">
            Xplorer is free and open source. If you find it useful, consider sponsoring to help keep
            development going.
          </p>
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-pink-500 text-white hover:bg-pink-600 transition-colors"
          >
            <Heart size={12} />
            Become a Sponsor
            <ExternalLink size={10} />
          </a>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-xp-hover/50 border-t border-xp-border flex items-center justify-between">
          <span className="text-xs text-xp-muted">You can show this again in Settings</span>
          <button
            onClick={handleDismiss}
            className="rounded-md px-4 py-1.5 text-sm font-medium bg-xp-blue text-white hover:opacity-90 transition-opacity"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default BetaWarningDialog;
