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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-xp-surface rounded-lg shadow-2xl w-[480px] max-w-[90vw] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-xp-border">
          <div className="flex items-center space-x-3">
            {isEncrypt ? (
              <Lock size={20} className="text-xp-blue" />
            ) : (
              <Unlock size={20} className="text-xp-green" />
            )}
            <h2 className="text-xl font-semibold text-xp-text">
              {isEncrypt ? 'Encrypt File' : 'Decrypt File'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={processing}
            className="p-2 hover:bg-xp-surface-light rounded-md transition-colors disabled:opacity-50"
            aria-label="Close encryption dialog"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* File info */}
          <div className="bg-xp-bg rounded-lg p-4">
            <div className="text-sm text-xp-text-muted mb-1">File</div>
            <div className="text-sm text-xp-text font-medium truncate" title={filePath}>
              {fileName}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-xp-text-muted">
            {isEncrypt
              ? 'Enter a password to encrypt this file using AES-256-GCM. The encrypted file will be saved with a .enc extension.'
              : 'Enter the password used to encrypt this file. The decrypted file will be saved without the .enc extension.'}
          </p>

          {/* Password field */}
          <div>
            <label className="block text-sm font-medium text-xp-text mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2 pr-10 border border-xp-border rounded-md bg-xp-bg text-xp-text focus:ring-2 focus:ring-xp-blue focus:border-xp-blue"
                placeholder="Enter password..."
                autoFocus
                disabled={processing}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xp-text-muted hover:text-xp-text transition-colors"
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
              <label className="block text-sm font-medium text-xp-text mb-2">
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
                  className="w-full px-3 py-2 pr-10 border border-xp-border rounded-md bg-xp-bg text-xp-text focus:ring-2 focus:ring-xp-blue focus:border-xp-blue"
                  placeholder="Confirm password..."
                  disabled={processing}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xp-text-muted hover:text-xp-text transition-colors"
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
            <div className="flex items-start space-x-2 p-3 rounded-md bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30">
              <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Processing indicator */}
          {processing && (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-xp-blue"></div>
              <span className="ml-3 text-sm text-xp-text-muted">
                {isEncrypt ? 'Encrypting...' : 'Decrypting...'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-xp-border bg-xp-bg">
          <button
            onClick={handleClose}
            disabled={processing}
            className="px-4 py-2 text-xp-text hover:bg-xp-surface-light rounded transition-colors disabled:opacity-50"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing || !password}
            className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            aria-label={isEncrypt ? 'Encrypt file' : 'Decrypt file'}
          >
            {processing && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>
              {processing
                ? isEncrypt
                  ? 'Encrypting...'
                  : 'Decrypting...'
                : isEncrypt
                  ? 'Encrypt'
                  : 'Decrypt'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EncryptionDialog;
