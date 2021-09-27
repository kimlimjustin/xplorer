declare module 'electron-json-storage-sync' {
    export function set(key: string, data: any): null;
    export function get(key: string): { status: boolean; data: any };
    export function clear(): { status: boolean; data: any };
    export function keys(): { status: boolean; data: any };
    export function remove(key: string): { status: boolean; data: any };
    export function has(key: string): { status: boolean; data: boolean };
}
