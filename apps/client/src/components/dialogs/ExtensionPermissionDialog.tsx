import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Permission descriptions ──────────────────────────────────────────────────

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'file:read': 'Read files on your computer',
  'file:write': 'Create and modify files',
  'file:delete': 'Delete files and folders',
  'file:execute': 'Run executable files and scripts',
  'system:exec': 'Run system commands',
  'system:commands': 'Execute shell commands on your system',
  'system:network': 'Access network resources',
  fetch: 'Make network requests',
  network: 'Access network resources',
  'native:invoke': 'Run native code with full system access',
  clipboard: 'Access clipboard',
  'ui:clipboard': 'Access clipboard',
  storage: 'Store persistent data',
  'ui:notification': 'Show notifications',
  'ui:notifications': 'Show notifications',
  'ui:panels': 'Add custom panels to the interface',
  'ui:modify': 'Change the appearance and layout of the app',
  'directory:list': 'View files inside folders',
  'directory:create': 'Create new folders',
  'directory:delete': 'Delete folders and their contents',
  'xplorer:settings': 'Read and modify Xplorer settings',
  'xplorer:extensions': 'Install, disable, or remove other extensions',
  'xplorer:themes': 'Add custom color themes',
  'xplorer:history': 'Read browsing and navigation history',
};

/** Permissions considered dangerous -- highlighted with orange/red */
const DANGEROUS_PERMISSIONS = new Set([
  'fetch',
  'network',
  'system:exec',
  'system:commands',
  'system:network',
  'file:write',
  'file:delete',
  'file:execute',
  'native:invoke',
]);

// ── Permission icons (inline SVG) ───────────────────────────────────────────

const PermIcon = ({ perm }: { perm: string }) => {
  const s = 14;
  const props = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (perm.startsWith('file:read')) {
    return (
      <svg {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }
  if (perm.startsWith('file:write')) {
    return (
      <svg {...props}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }
  if (perm.startsWith('file:delete')) {
    return (
      <svg {...props}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    );
  }
  if (perm.startsWith('file:execute') || perm.startsWith('system:')) {
    return (
      <svg {...props}>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    );
  }
  if (perm.startsWith('directory:')) {
    return (
      <svg {...props}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (perm === 'fetch' || perm === 'network') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  if (perm.includes('notification')) {
    return (
      <svg {...props}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    );
  }
  if (perm.includes('panel') || perm.includes('modify')) {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    );
  }
  if (perm.includes('clipboard')) {
    return (
      <svg {...props}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    );
  }
  if (perm.includes('storage')) {
    return (
      <svg {...props}>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
};

// ── Event types ──────────────────────────────────────────────────────────────

export interface ExtensionPermissionRequestDetail {
  extensionId: string;
  extensionName: string;
  displayName?: string;
  version: string;
  author: string;
  permissions: string[];
}

/** Custom event name used to request permission consent from the UI layer */
export const EXTENSION_PERMISSION_REQUEST_EVENT = 'extension-permission-request';

/** Custom event name used to respond to a permission request */
export const EXTENSION_PERMISSION_RESPONSE_EVENT = 'extension-permission-response';

// ── Helper: localStorage consent key ─────────────────────────────────────────

export const getConsentKey = (extensionId: string): string => {
  return `xplorer:ext-consent:${extensionId}`;
};

export const hasStoredConsent = (extensionId: string): boolean => {
  return localStorage.getItem(getConsentKey(extensionId)) === 'granted';
};

export const storeConsent = (extensionId: string, granted: boolean): void => {
  if (granted) {
    localStorage.setItem(getConsentKey(extensionId), 'granted');
  } else {
    localStorage.removeItem(getConsentKey(extensionId));
  }
};

export const revokeConsent = (extensionId: string): void => {
  localStorage.removeItem(getConsentKey(extensionId));
};

// ── Consent helpers ─────────────────────────────────────────────────────────

/** Returns true when any requested permission needs an interactive consent dialog */
export const requiresConsentDialog = (permissions: string[]): boolean => {
  return permissions.length > 0;
};

/** Show a single-extension permission consent dialog. Resolves true if user allows. */
export const requestPermissionConsent = (
  detail: ExtensionPermissionRequestDetail,
): Promise<boolean> => {
  if (hasStoredConsent(detail.extensionId)) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const event = new CustomEvent(EXTENSION_PERMISSION_REQUEST_EVENT, {
      detail: { detail, resolve },
    });
    window.dispatchEvent(event);
  });
};

/** Show permission consent for multiple extensions sequentially. Resolves false if any denied. */
export const requestBulkPermissionConsent = async (
  details: ExtensionPermissionRequestDetail[],
): Promise<boolean> => {
  for (const detail of details) {
    const granted = await requestPermissionConsent(detail);
    if (!granted) return false;
  }
  return true;
};

// ── Component ────────────────────────────────────────────────────────────────

const ExtensionPermissionDialog = () => {
  const [request, setRequest] = useState<ExtensionPermissionRequestDetail | null>(null);
  const [remember, setRemember] = useState(true);
  const resolverRef = useRef<((granted: boolean) => void) | null>(null);

  const handleEvent = useCallback((e: Event) => {
    const customEvent = e as CustomEvent<{
      detail: ExtensionPermissionRequestDetail;
      resolve: (granted: boolean) => void;
    }>;
    const { detail, resolve } = customEvent.detail;
    resolverRef.current = resolve;
    setRequest(detail);
    setRemember(true);
  }, []);

  useEffect(() => {
    window.addEventListener(EXTENSION_PERMISSION_REQUEST_EVENT, handleEvent);
    return () => {
      window.removeEventListener(EXTENSION_PERMISSION_REQUEST_EVENT, handleEvent);
    };
  }, [handleEvent]);

  const handleAllow = useCallback(() => {
    if (!request) return;
    if (remember) {
      storeConsent(request.extensionId, true);
    }
    resolverRef.current?.(true);
    resolverRef.current = null;
    setRequest(null);
  }, [request, remember]);

  const handleDeny = useCallback(() => {
    if (!request) return;
    resolverRef.current?.(false);
    resolverRef.current = null;
    setRequest(null);
  }, [request]);

  // Handle Escape key
  useEffect(() => {
    if (!request) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDeny();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [request, handleDeny]);

  if (!request) return null;

  const permissions = request.permissions || [];
  const dangerousCount = permissions.filter((p) => DANGEROUS_PERMISSIONS.has(p)).length;
  const hasDangerous = dangerousCount > 0;
  const displayName = request.displayName || request.extensionName;

  // Sort: dangerous permissions first, then safe
  const sortedPermissions = [...permissions].sort((a, b) => {
    const aDanger = DANGEROUS_PERMISSIONS.has(a) ? 0 : 1;
    const bDanger = DANGEROUS_PERMISSIONS.has(b) ? 0 : 1;
    if (aDanger !== bDanger) return aDanger - bDanger;
    return a.localeCompare(b);
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={handleDeny}
    >
      <div
        style={{
          position: 'relative',
          width: '420px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          borderRadius: '16px',
          backgroundColor: 'rgba(var(--xp-bg-rgb, 26, 27, 38), 0.85)',
          border: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.6)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column' as const,
          animation: 'dialogFadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background:
                  'linear-gradient(135deg, rgba(122, 162, 247, 0.2), rgba(122, 162, 247, 0.08))',
                border: '1px solid rgba(122, 162, 247, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(122, 162, 247, 0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--xp-text, #c0caf5)' }}>
                Extension Permissions
              </div>
              <div style={{ fontSize: '11px', color: 'var(--xp-text-muted, #565f89)' }}>
                Review before activating
              </div>
            </div>
          </div>
          <button
            style={{
              padding: '5px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--xp-text-muted, #565f89)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={handleDeny}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = 'var(--xp-text, #c0caf5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--xp-text-muted, #565f89)';
            }}
            aria-label="Deny and close"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '14px 20px', overflowY: 'auto' as const, flex: 1 }}>
          {/* Extension info */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--xp-text, #c0caf5)' }}>
              {displayName}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--xp-text-muted, #565f89)',
                marginTop: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>v{request.version}</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>by {request.author}</span>
            </div>
          </div>

          {/* Warning for dangerous permissions */}
          {hasDangerous && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                marginBottom: '12px',
              }}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f87171"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--xp-text-muted, #a9b1d6)',
                  lineHeight: 1.4,
                }}
              >
                Requests{' '}
                <span style={{ color: '#f87171', fontWeight: 500 }}>
                  {dangerousCount} sensitive permission{dangerousCount > 1 ? 's' : ''}
                </span>
                . Only allow if you trust this extension.
              </span>
            </div>
          )}

          {/* Section label */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--xp-text-muted, #565f89)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              marginBottom: '8px',
            }}
          >
            Permissions ({permissions.length})
          </div>

          {/* Permission list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column' as const,
              gap: '4px',
              marginBottom: '14px',
            }}
          >
            {sortedPermissions.map((perm) => {
              const isDangerous = DANGEROUS_PERMISSIONS.has(perm);
              const description = PERMISSION_DESCRIPTIONS[perm] || 'Unknown permission';
              return (
                <div
                  key={perm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    backgroundColor: isDangerous
                      ? 'rgba(249, 115, 22, 0.06)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isDangerous ? 'rgba(249, 115, 22, 0.15)' : 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.3)'}`,
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      backgroundColor: isDangerous
                        ? 'rgba(249, 115, 22, 0.1)'
                        : 'rgba(122, 162, 247, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: isDangerous ? '#fb923c' : 'rgba(122, 162, 247, 0.7)',
                    }}
                  >
                    <PermIcon perm={perm} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: isDangerous ? '#fb923c' : 'var(--xp-text, #c0caf5)',
                      }}
                    >
                      {perm}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--xp-text-muted, #565f89)' }}>
                      {description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Remember checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              userSelect: 'none' as const,
            }}
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{
                width: '14px',
                height: '14px',
                accentColor: 'var(--xp-blue, #7aa2f7)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--xp-text-muted, #565f89)' }}>
              Remember for this extension
            </span>
          </label>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 20px',
            borderTop: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.4)',
          }}
        >
          <button
            style={{
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '8px',
              cursor: 'pointer',
              border: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.5)',
              backgroundColor: 'transparent',
              color: 'var(--xp-text, #c0caf5)',
              transition: 'background-color 0.15s',
            }}
            onClick={handleDeny}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Deny
          </button>
          <button
            style={{
              padding: '7px 20px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '8px',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: hasDangerous
                ? 'rgba(249, 115, 22, 0.85)'
                : 'rgba(122, 162, 247, 0.85)',
              color: '#fff',
              transition: 'opacity 0.15s',
            }}
            onClick={handleAllow}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtensionPermissionDialog;
