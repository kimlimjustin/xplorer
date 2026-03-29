// Stub declarations for @tanstack/react-virtual when used from client components
// that are type-checked under the web project tsconfig.

declare module '@tanstack/react-virtual' {
  export interface VirtualItem {
    key: string | number;
    index: number;
    start: number;
    end: number;
    size: number;
    lane: number;
  }

  export interface Virtualizer<_TScrollElement, _TItemElement> {
    getVirtualItems: () => VirtualItem[];
    getTotalSize: () => number;
    scrollToIndex: (index: number, options?: { align?: string }) => void;
    measure: () => void;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useVirtualizer<TScrollElement extends Element, TItemElement extends Element>(options: any): Virtualizer<TScrollElement, TItemElement>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useWindowVirtualizer<TItemElement extends Element>(options: any): Virtualizer<Window, TItemElement>;
}
