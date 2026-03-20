import React, { useEffect, useRef, useCallback, useId } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  /** Explicit id to link aria-labelledby to a DialogTitle. Auto-generated if omitted. */
  titleId?: string;
  /** When true, Escape key and backdrop click will not close the dialog. */
  preventClose?: boolean;
  /** Whether clicking the backdrop closes the dialog. Default true. */
  closeOnBackdropClick?: boolean;
}

// React context so DialogTitle can read the resolved titleId without extra props.
const DialogContext = React.createContext<{ titleId: string } | null>(null);

export const Dialog = ({
  open,
  onOpenChange,
  children,
  titleId: titleIdProp,
  preventClose = false,
  closeOnBackdropClick = true,
}: DialogProps) => {
  const autoId = useId();
  const titleId = titleIdProp ?? `dialog-title-${autoId}`;

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // ---- helpers ----
  const requestClose = useCallback(() => {
    if (!preventClose) {
      onOpenChange?.(false);
    }
  }, [preventClose, onOpenChange]);

  // ---- focus trap & auto-focus ----
  useEffect(() => {
    if (!open) return;

    // Save the element that was focused before the dialog opened.
    previousFocusRef.current = document.activeElement;

    // Small delay so the dialog DOM is painted before we query focusable elements.
    const raf = requestAnimationFrame(() => {
      const container = dialogRef.current;
      if (!container) return;

      // Auto-focus: prefer [data-autofocus], then first focusable, then the container itself.
      const autofocusEl = container.querySelector<HTMLElement>('[data-autofocus]');
      if (autofocusEl) {
        autofocusEl.focus();
      } else {
        const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (first) {
          first.focus();
        } else {
          container.focus();
        }
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [open]);

  // ---- restore focus on close ----
  useEffect(() => {
    if (open) return;
    // When the dialog just closed, restore focus to the previously-focused element.
    const prev = previousFocusRef.current;
    if (prev && prev instanceof HTMLElement) {
      prev.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // ---- keyboard handling (Escape + Tab trap) ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }

      if (e.key === 'Tab') {
        const container = dialogRef.current;
        if (!container) return;

        const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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
    },
    [requestClose],
  );

  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdropClick) {
      requestClose();
    }
  }, [closeOnBackdropClick, requestClose]);

  if (!open) return null;

  return (
    <DialogContext.Provider value={{ titleId }}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        onClick={handleBackdropClick}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="bg-xp-popover rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden border border-xp-border"
          style={{ outline: 'none' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {children}
        </div>
      </div>
    </DialogContext.Provider>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogContent = ({ children, className = '' }: DialogContentProps) => {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

export const DialogHeader = ({ children }: DialogHeaderProps) => {
  return <div className="mb-4 pb-4 border-b border-xp-border">{children}</div>;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
  /** Override the auto-generated id used for aria-labelledby linking. */
  id?: string;
}

export const DialogTitle = ({ children, className = '', id: idProp }: DialogTitleProps) => {
  const ctx = React.useContext(DialogContext);
  const resolvedId = idProp ?? ctx?.titleId;

  return (
    <h2 id={resolvedId} className={`text-xl font-semibold text-xp-text ${className}`}>
      {children}
    </h2>
  );
}

interface DialogDescriptionProps {
  children: React.ReactNode;
}

export const DialogDescription = ({ children }: DialogDescriptionProps) => {
  return <p className="text-sm text-xp-text-secondary mt-2">{children}</p>;
}

interface DialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export const DialogTrigger = ({ children }: DialogTriggerProps) => {
  return <>{children}</>;
}

interface DialogFooterProps {
  children: React.ReactNode;
}

export const DialogFooter = ({ children }: DialogFooterProps) => {
  return <div className="flex justify-end gap-2 pt-4 border-t border-xp-border">{children}</div>;
}
