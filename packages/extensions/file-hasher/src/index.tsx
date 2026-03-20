/**
 * File Hasher Extension
 *
 * Demonstrates: Command.register() for multiple commands, Web Crypto API,
 * clipboard access, UI notifications.
 *
 * Usage: Right-click any file → "Calculate SHA-256 Hash" (or run via command).
 */

import { Command, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Hash Utilities ──────────────────────────────────────────────────────────

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return hex.join('');
}

async function computeHash(data: ArrayBuffer, algorithm: string): Promise<string> {
  if (algorithm === 'MD5') {
    return computeMD5(new Uint8Array(data));
  }
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  return bufferToHex(hashBuffer);
}

// Minimal MD5 implementation (RFC 1321)
function computeMD5(data: Uint8Array): string {
  function md5cycle(x: number[], k: number[]) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);   d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);  b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);      b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);   d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);   b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);  b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);     d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);   b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);  d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);   b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);       d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);  b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);   d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);   b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);   b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);   b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);   d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);  b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function add32(a: number, b: number) { return (a + b) & 0xFFFFFFFF; }

  const n = data.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i: number;

  for (i = 64; i <= n; i += 64) {
    const block: number[] = [];
    for (let j = 0; j < 64; j += 4) {
      block.push(data[i - 64 + j] | (data[i - 64 + j + 1] << 8) | (data[i - 64 + j + 2] << 16) | (data[i - 64 + j + 3] << 24));
    }
    md5cycle(state, block);
  }

  const tail: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (i = i - 64; i < n; i++) {
    tail[i >> 2 & 15] |= data[i] << ((i % 4) << 3);
  }
  tail[i >> 2 & 15] |= 0x80 << ((i % 4) << 3);

  if (i > 55) {
    md5cycle(state, tail);
    for (i = 0; i < 16; i++) tail[i] = 0;
  }
  tail[14] = (n * 8) & 0xFFFFFFFF;
  tail[15] = Math.floor((n * 8) / 0x100000000);
  md5cycle(state, tail);

  const hex: string[] = [];
  for (i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      hex.push(((state[i] >> (j * 8)) & 0xFF).toString(16).padStart(2, '0'));
    }
  }
  return hex.join('');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSelectedFile(): { name: string; path: string; is_dir: boolean } | null {
  const state = (window as Record<string, unknown>).__xplorer_state__ as
    { selectedFiles?: Array<{ name: string; path: string; is_dir: boolean }> } | undefined;
  const files = state?.selectedFiles || [];
  return files.length > 0 ? files[0] : null;
}

async function hashFile(algorithm: 'SHA-256' | 'SHA-1' | 'MD5', api: XplorerAPI): Promise<void> {
  const file = getSelectedFile();

  if (!file) {
    api.ui.showMessage('No file selected. Select a file first.', 'warning');
    return;
  }

  if (file.is_dir) {
    api.ui.showMessage('Cannot hash a directory. Select a file.', 'warning');
    return;
  }

  try {
    api.ui.showMessage(`Computing ${algorithm} hash for "${file.name}"...`, 'info');

    const data = await api.files.read(file.path);
    const hash = await computeHash(data, algorithm);

    try {
      await navigator.clipboard.writeText(hash);
      api.ui.showMessage(
        `${algorithm}: ${hash} (${formatSize(data.byteLength)}) — copied to clipboard`,
        'info'
      );
    } catch {
      api.ui.showMessage(`${algorithm}: ${hash} (${formatSize(data.byteLength)})`, 'info');
    }
  } catch (err) {
    api.ui.showMessage(`Failed to compute hash: ${err}`, 'error');
  }
}

// ── Registration ────────────────────────────────────────────────────────────

Command.register({
  id: 'xplorer-file-hasher.sha256',
  title: 'Calculate SHA-256 Hash',
  permissions: ['file:read', 'ui:notifications'],
  action: (api) => hashFile('SHA-256', api),
});

Command.register({
  id: 'xplorer-file-hasher.sha1',
  title: 'Calculate SHA-1 Hash',
  permissions: ['file:read', 'ui:notifications'],
  action: (api) => hashFile('SHA-1', api),
});

Command.register({
  id: 'xplorer-file-hasher.md5',
  title: 'Calculate MD5 Hash',
  permissions: ['file:read', 'ui:notifications'],
  action: (api) => hashFile('MD5', api),
});
