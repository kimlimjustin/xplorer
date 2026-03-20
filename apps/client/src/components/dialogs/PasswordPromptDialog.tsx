import React, { useState, useEffect, useRef } from 'react';

interface PasswordPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string, remember: boolean) => void;
  title: string;
  description: string;
  showRememberOption?: boolean;
  isLoading?: boolean;
  // Legacy SSH-specific props for backward compatibility
  connectionName?: string;
  username?: string;
  host?: string;
}

export const PasswordPromptDialog = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  showRememberOption = false,
  isLoading = false,
  // Legacy props
  connectionName,
  username,
  host,
}: PasswordPromptDialogProps) => {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // For backward compatibility, construct title and description from legacy props
  const displayTitle = title || 'SSH Authentication Required';
  const displayDescription =
    description ||
    (connectionName && username && host
      ? `Please enter your password to connect to ${username}@${host} (${connectionName}).`
      : 'Please enter your password to continue.');

  useEffect(() => {
    if (isOpen) {
      // Reset form when dialog opens
      setPassword('');
      setRemember(false);
      // Focus the dialog container for screen readers
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password, remember);
    }
  };

  const handleClose = () => {
    if (isLoading) return; // Don't allow closing while loading

    setPassword('');
    setRemember(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="password-dialog-title"
        aria-describedby="password-dialog-description"
        aria-modal="true"
        tabIndex={-1}
        className="bg-xp-surface border border-xp-border rounded-lg p-6 w-96 max-w-full"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !isLoading) {
            handleClose();
          }
          // Focus trap: cycle focus within the dialog
          if (e.key === 'Tab' && dialogRef.current) {
            const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="password-dialog-title" className="text-lg font-medium">
            {displayTitle}
          </h3>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-xp-text-muted hover:text-xp-text disabled:opacity-50 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          {/* Legacy SSH connection details for backward compatibility */}
          {connectionName && username && host && (
            <div className="text-sm text-xp-text-muted mb-3">
              <p>
                <strong>Connection:</strong> {connectionName}
              </p>
              <p>
                <strong>Server:</strong> {username}@{host}
              </p>
            </div>
          )}
          <p id="password-dialog-description" className="text-sm text-xp-text">
            {displayDescription}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="password form">
          <div>
            <label htmlFor="password-input" className="block text-sm font-medium mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password.trim()) {
                    e.preventDefault();
                    onSubmit(password, remember);
                  }
                }}
                className="w-full px-3 py-2 pr-10 bg-xp-bg border border-xp-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-xp-blue focus:border-transparent"
                placeholder="Enter your password"
                autoFocus
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xp-text-muted hover:text-xp-text transition-colors"
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                      clipRule="evenodd"
                    />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path
                      fillRule="evenodd"
                      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {showRememberOption && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded"
                disabled={isLoading}
              />
              <label htmlFor="remember" className="text-sm text-xp-text-muted">
                Remember password for this session
              </label>
            </div>
          )}

          <div
            className="bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-20 rounded p-3"
            role="note"
          >
            <div className="flex items-start space-x-2">
              <svg
                className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm">
                <p className="text-yellow-400 font-medium">Security Notice</p>
                <p className="text-yellow-300 text-xs mt-1">
                  Passwords are stored securely in memory and are not saved to disk unless you
                  explicitly save the connection with a password.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm border border-xp-border rounded hover:bg-xp-surface-light transition-colors disabled:opacity-50"
              aria-label="Cancel authentication"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="px-4 py-2 text-sm bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              aria-label={isLoading ? 'Authenticating' : 'Continue with authentication'}
            >
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{isLoading ? 'Authenticating...' : 'Continue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
