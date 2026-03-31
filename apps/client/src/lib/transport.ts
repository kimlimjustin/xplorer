/**
 * Transport abstraction layer for Xplorer.
 *
 * The canonical implementation lives in `@xplorer/sdk`.  This module
 * re-exports everything so existing imports (`@/lib/transport`) keep working.
 */
export { transport, listenToEvent, convertAssetUrl, isTauri, getApiUrl } from '@xplorer/sdk';
