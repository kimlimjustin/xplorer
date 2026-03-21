import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI } from '@/lib/tauri-api';
import { Eye, EyeOff, Lock, Unlock, AlertTriangle } from 'lucide-react';

export type EncryptionMode = 'encrypt' | 'decrypt';

interface EncryptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  filePath: string;
  mode: EncryptionMode;
}

const EncryptionDialog = ({
  isOpen,
  onClose,
  onComplete,
  filePath,
  mode,
}: EncryptionDialogProps) => {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const isEncrypt = mode === 'encrypt';

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError(null);
      setProcessing(false);
    }
  }, [isOpen]);

  const validate = (): string | null => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 4) {
      return 'Password must be at least 4 characters';
    }
    if (isEncrypt && password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let resultPath: string;
      if (isEncrypt) {
        resultPath = await TauriAPI.encryptFile(filePath, password);
      } else {
        resultPath = await TauriAPI.decryptFile(filePath, password);
      }

      const resultName = resultPath.split(/[/\\]/).pop() || resultPath;
      toast({
        title: isEncrypt ? 'File Encrypted' : 'File Decrypted',
        description: `Successfully created ${resultName}`,
      });

      onComplete?.();
      onClose();
    } catch (err) {
      const message = (err as Error).message || String(err);
      setError(message);
      toast({
        title: isEncrypt ? 'Encryption Failed' : 'Decryption Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (processing) return;
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !processing) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  let buttonLabel: string;
  if (processing) {
    buttonLabel = isEncrypt ? 'Encrypting...' : 'Decrypting...';
  } else {
    buttonLabel = isEncrypt ? 'Encrypt' : 'Decrypt';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        className="bg-xp-surface w-[480px] max-w-[90vw] overflow-hidden rounded-lg shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="border-xp-border flex items-center justify-between border-b p-6">
          <div className="flex items-center space-x-3">
            {isEncrypt ? (
              <Lock size={20} className="text-xp-blue" />
            ) : (
              <Unlock size={20} className="text-xp-green" />
            )}
            <h2 className="text-xp-text text-xl font-semibold">
              {isEncrypt ? 'Encrypt File' : 'Decrypt File'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={processing}
            className="hover:bg-xp-surface-light rounded-md p-2 transition-colors disabled:opacity-50"
            aria-label="Close encryption dialog"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 p-6">
          {/* File info */}
          <div className="bg-xp-bg rounded-lg p-4">
            <div className="text-xp-text-muted mb-1 text-sm">File</div>
            <div className="text-xp-text truncate text-sm font-medium" title={filePath}>
              {fileName}
            </div>
          </div>

          {/* Description */}
          <p className="text-xp-text-muted text-sm">
            {isEncrypt
              ? 'Enter a password to encrypt this file using AES-256-GCM. The encrypted file will be saved with a .enc extension.'
              : 'Enter the password used to encrypt this file. The decrypted file will be saved without the .enc extension.'}
          </p>

          {/* Password field */}
          <div>
            <label className="text-xp-text mb-2 block text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="border-xp-border bg-xp-bg text-xp-text focus:ring-xp-blue focus:border-xp-blue w-full rounded-md border px-3 py-2 pr-10 focus:ring-2"
                placeholder="Enter password..."
                autoFocus
                disabled={processing}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xp-text-muted hover:text-xp-text absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password field (encrypt mode only) */}
          {isEncrypt && (
            <div>
              <label className="text-xp-text mb-2 block text-sm font-medium">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  className="border-xp-border bg-xp-bg text-xp-text focus:ring-xp-blue focus:border-xp-blue w-full rounded-md border px-3 py-2 pr-10 focus:ring-2"
                  placeholder="Confirm password..."
                  disabled={processing}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-xp-text-muted hover:text-xp-text absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors"
                  aria-label={
                    showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                  }
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start space-x-2 rounded-md border border-red-500 border-opacity-30 bg-red-500 bg-opacity-10 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Processing indicator */}
          {processing && (
            <div className="flex items-center justify-center py-2">
              <div className="border-xp-blue h-5 w-5 animate-spin rounded-full border-b-2" />
              <span className="text-xp-text-muted ml-3 text-sm">
                {isEncrypt ? 'Encrypting...' : 'Decrypting...'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-xp-border bg-xp-bg flex justify-end space-x-3 border-t p-6">
          <button
            onClick={handleClose}
            disabled={processing}
            className="text-xp-text hover:bg-xp-surface-light rounded px-4 py-2 transition-colors disabled:opacity-50"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing || !password}
            className="bg-xp-blue hover:bg-xp-blue-dark flex items-center space-x-2 rounded px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isEncrypt ? 'Encrypt file' : 'Decrypt file'}
          >
            {processing && (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
            )}
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EncryptionDialog;
