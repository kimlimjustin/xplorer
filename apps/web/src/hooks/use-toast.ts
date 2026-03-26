// Mock useToast for web context

export function useToast() {
  return {
    toast: (_opts: { title?: string; description?: string; variant?: string }) => {},
    dismiss: (_id?: string) => {},
    toasts: [],
  };
}

export function toast(_opts: { title?: string; description?: string; variant?: string }) {}
