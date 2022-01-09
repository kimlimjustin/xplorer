/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Check if it's running on Tauri
 */
const isTauri = Boolean(
	typeof window !== 'undefined' && window != undefined && (window as any).__TAURI__ !== undefined && (window as any).promisified !== null
);
export default isTauri;
