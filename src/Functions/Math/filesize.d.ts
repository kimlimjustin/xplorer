/**
 * Convert file size into human readable file size
 * @param {number} bytes - Bytes
 * @param {boolean} kBlockFormat - is input bytes on k block format?
 * @returns {Float32Array} Human readable file size
*/
export function formatBytes(bytes: number, kBlockFormat?: boolean): Float32Array