import React from 'react';
import { useToast, toast } from '@/hooks/use-toast';

interface ToastProps {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: 'default' | 'destructive';
  open?: boolean;
  onClose?: () => void;
}

const Toast = ({ id: _id, title, description, variant = 'default', open = true, onClose }: ToastProps) => {
  const baseClasses =
    'relative flex w-full overflow-hidden rounded-lg border shadow-lg transition-all duration-200 ease-in-out transform';
  const variantClasses =
    variant === 'destructive'
      ? 'bg-red-900 border-red-800 text-red-100'
      : 'bg-xp-surface border-xp-border text-xp-text';
  const visibilityClasses = open
    ? 'opacity-100 scale-100 translate-y-0'
    : 'opacity-0 scale-95 translate-y-1 pointer-events-none';

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${visibilityClasses}`}
      role="status"
      aria-live={variant === 'destructive' ? 'assertive' : 'polite'}
    >
      <div className="flex-1 p-4">
        {title && <div className="font-semibold text-sm mb-1">{title}</div>}
        {description && <div className="text-xs opacity-90">{description}</div>}
      </div>

      <button
        onClick={onClose}
        className="flex-shrink-0 p-4 hover:bg-black hover:bg-opacity-10 transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

export const Toaster = () => {
  const { toasts, dismiss, remove } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div key={toast.id} className="relative">
          <Toast
            id={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            open={toast.open !== false}
            onClose={() => {
              dismiss(toast.id);
              setTimeout(() => {
                remove(toast.id);
              }, 150);
            }}
          />
        </div>
      ))}
    </div>
  );
}

// Extended toast components for confirmation and input
interface ConfirmationToastProps {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmationToast = ({
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: ConfirmationToastProps) => {
  return (
    <div className="relative flex w-full overflow-hidden rounded-lg border shadow-lg bg-xp-surface border-xp-border text-xp-text">
      <div className="flex-1 p-4">
        <div className="font-semibold text-sm mb-1">{title}</div>
        {description && <div className="text-xs opacity-90 mb-3">{description}</div>}
        <div className="flex space-x-2">
          <button
            onClick={onConfirm}
            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-xp-bg text-xp-text text-xs rounded hover:bg-xp-surface-light transition-colors border border-xp-border"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface InputToastProps {
  title: string;
  description?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  submitText?: string;
  cancelText?: string;
}

const InputToast = ({
  title,
  description,
  placeholder = '',
  onSubmit,
  onCancel,
  submitText = 'Create',
  cancelText = 'Cancel',
}: InputToastProps) => {
  const [value, setValue] = React.useState('');

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="relative flex w-full overflow-hidden rounded-lg border shadow-lg bg-xp-surface border-xp-border text-xp-text">
      <div className="flex-1 p-4">
        <div className="font-semibold text-sm mb-1">{title}</div>
        {description && <div className="text-xs opacity-90 mb-3">{description}</div>}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-xp-bg border border-xp-border rounded text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-xp-blue"
          autoFocus
        />
        <div className="flex space-x-2">
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-3 py-1 bg-xp-blue text-white text-xs rounded hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitText}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-xp-bg text-xp-text text-xs rounded hover:bg-xp-surface-light transition-colors border border-xp-border"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper functions to show confirmation and input toasts
export const showConfirmationToast = (
  options: Omit<ConfirmationToastProps, 'onConfirm' | 'onCancel'>,
) : Promise<boolean> => {
  return new Promise((resolve) => {
    const { id: _confirmId, dismiss } = toast({
      title: options.title,
      description: (
        <div className="space-y-3">
          {options.description && <div className="text-xs opacity-90">{options.description}</div>}
          <div className="flex space-x-2">
            <button
              onClick={() => {
                resolve(true);
                dismiss();
              }}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
            >
              {options.confirmText || 'Confirm'}
            </button>
            <button
              onClick={() => {
                resolve(false);
                dismiss();
              }}
              className="px-3 py-1 bg-xp-bg text-xp-text text-xs rounded hover:bg-xp-surface-light transition-colors border border-xp-border"
            >
              {options.cancelText || 'Cancel'}
            </button>
          </div>
        </div>
      ),
    });
  });
}

export const showInputToast = (
  options: Omit<InputToastProps, 'onSubmit' | 'onCancel'>,
) : Promise<string | null> => {
  return new Promise((resolve) => {
    let inputValue = '';

    const { id: _inputId, dismiss } = toast({
      title: options.title,
      description: (
        <div className="space-y-3">
          {options.description && <div className="text-xs opacity-90">{options.description}</div>}
          <input
            type="text"
            onChange={(e) => {
              inputValue = e.target.value;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                resolve(inputValue.trim());
                dismiss();
              } else if (e.key === 'Escape') {
                resolve(null);
                dismiss();
              }
            }}
            placeholder={options.placeholder || ''}
            className="w-full px-3 py-2 bg-xp-bg border border-xp-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-xp-blue"
            autoFocus
          />
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  resolve(inputValue.trim());
                  dismiss();
                }
              }}
              className="px-3 py-1 bg-xp-blue text-white text-xs rounded hover:bg-opacity-80 transition-colors"
            >
              {options.submitText || 'Create'}
            </button>
            <button
              onClick={() => {
                resolve(null);
                dismiss();
              }}
              className="px-3 py-1 bg-xp-bg text-xp-text text-xs rounded hover:bg-xp-surface-light transition-colors border border-xp-border"
            >
              {options.cancelText || 'Cancel'}
            </button>
          </div>
        </div>
      ),
    });
  });
}

export { Toast, ConfirmationToast, InputToast };
