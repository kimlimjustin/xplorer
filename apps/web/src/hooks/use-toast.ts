// Mock useToast for web context

interface ToastItem {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  title?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  description?: any;
  variant?: 'default' | 'destructive';
  open?: boolean;
}

export const useToast = () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toast: (_opts: { title?: string; description?: any; variant?: string }) => {},
    dismiss: (_id?: string) => {},
    remove: (_id: string) => {},
    toasts: [] as ToastItem[],
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toast = (_opts: { title?: string; description?: any; variant?: string }): { id: string; dismiss: () => void } => {
  return { id: 'mock-toast', dismiss: () => {} };
};
