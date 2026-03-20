/**
 * Xplorer SDK — Internal service layer.
 *
 * Re-exports every service module and all shared types.
 * Core app components import from `@xplorer/sdk` instead of TauriAPI directly.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export * from './types';

// ── Transport ─────────────────────────────────────────────────────────────────
export { transport, listenToEvent, convertAssetUrl, isTauri, getApiUrl } from './transport';

// ── Services (namespaced re-exports) ──────────────────────────────────────────
export * as FileSystem from './services/file-system';
export * as Search from './services/search';
export * as Storage from './services/storage';
export * as AI from './services/ai';
export * as Compression from './services/compression';
export * as System from './services/system';
export * as Git from './services/git';
export * as Extensions from './services/extensions';
export * as Shortcuts from './services/shortcuts';
export * as Duplicates from './services/duplicates';
export * as Comparison from './services/comparison';
export * as Organizer from './services/organizer';
export * as Analytics from './services/analytics';
export * as Chat from './services/chat';
export * as Agent from './services/agent';
export * as Sync from './services/sync';
export * as Database from './services/database';
export * as Images from './services/images';
export * as Backup from './services/backup';
export * as Audit from './services/audit';
export * as Docker from './services/docker';
export * as Versions from './services/versions';
