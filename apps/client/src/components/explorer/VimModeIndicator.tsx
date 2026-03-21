import React, { useState, useEffect, useRef } from 'react';
import type { VimMode } from '@/hooks/use-vim-mode';

// ── Mode color mapping ───────────────────────────────────────────────────────

const MODE_COLORS: Record<VimMode, string> = {
  normal: '#3b82f6',
  insert: '#22c55e',
  visual: '#a855f7',
  command: '#eab308',
};

const MODE_LABELS: Record<VimMode, string> = {
  normal: 'NORMAL',
  insert: 'INSERT',
  visual: 'VISUAL',
  command: 'COMMAND',
};

// ── Learning mode hints per mode ─────────────────────────────────────────────

const MODE_HINTS: Record<VimMode, string> = {
  normal: 'h/j/k/l=move  dd=delete  yy=yank  p=paste  /=search  :=command',
  insert: 'Esc=return to normal',
  visual: 'v=toggle  y=yank  d=delete  j/k=extend',
  command: ':w=save  :q=close  :e=edit',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface VimModeIndicatorProps {
  mode: VimMode;
  pendingKeys: string;
  learningMode: boolean;
}

// ── Keyframe animation style (injected once) ────────────────────────────────

const PULSE_KEYFRAMES = `
@keyframes vim-mode-pulse {
  0% { opacity: 1; box-shadow: 0 0 0 0 var(--vim-pulse-color); }
  50% { opacity: 0.85; box-shadow: 0 0 8px 2px var(--vim-pulse-color); }
  100% { opacity: 1; box-shadow: 0 0 0 0 var(--vim-pulse-color); }
}
`;

let styleInjected = false;
const ensurePulseStyle = () => {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = PULSE_KEYFRAMES;
  document.head.appendChild(style);
};

// ── Component ────────────────────────────────────────────────────────────────

const VimModeIndicator = React.memo(function VimModeIndicator({
  mode,
  pendingKeys,
  learningMode,
}: VimModeIndicatorProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const prevModeRef = useRef<VimMode>(mode);

  // Inject pulse keyframes on mount
  useEffect(() => {
    ensurePulseStyle();
  }, []);

  // Trigger pulse animation on mode change
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 300);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  const color = MODE_COLORS[mode];
  const label = MODE_LABELS[mode];

  // Container style — sits inline in the status bar left section
  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    position: 'relative',
  };

  // Mode badge style
  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '1px 8px',
    borderRadius: '3px',
    background: `${color}22`,
    border: `1px solid ${color}66`,
    color,
    fontSize: '11px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontWeight: 700,
    lineHeight: '16px',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    cursor: 'default',
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
    animation: isPulsing ? 'vim-mode-pulse 0.3s ease-out' : 'none',
    // CSS variable for the pulse keyframe
    ['--vim-pulse-color' as string]: `${color}44`,
  };

  // Pending keys display
  const pendingStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 5px',
    borderRadius: '3px',
    background: 'var(--xp-surface-light, rgba(255,255,255,0.06))',
    border: '1px solid var(--xp-border, rgba(255,255,255,0.08))',
    color: 'var(--xp-text-muted, #888)',
    fontSize: '11px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    lineHeight: '16px',
    whiteSpace: 'nowrap',
    cursor: 'default',
  };

  // Hints tooltip style (shown below on hover or always when learning mode)
  const hintsStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: '6px',
    padding: '4px 8px',
    borderRadius: '4px',
    background: 'var(--xp-surface, rgba(20, 20, 40, 0.95))',
    border: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
    color: 'var(--xp-text-muted, #aaa)',
    fontSize: '10px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    lineHeight: '14px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 50,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  };

  // The dot indicator before the mode label
  const dotStyle: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  };

  return (
    <div style={containerStyle} title={`Vim mode: ${label}`}>
      {/* Learning mode hints (shown above) */}
      {learningMode && (
        <div style={hintsStyle} aria-hidden="true">
          {MODE_HINTS[mode]}
        </div>
      )}

      {/* Mode badge */}
      <span style={badgeStyle} role="status" aria-label={`Vim mode: ${label}`} aria-live="polite">
        <span style={dotStyle} aria-hidden="true" />
        {label}
      </span>

      {/* Pending key sequence */}
      {pendingKeys && (
        <span
          style={pendingStyle}
          title={`Pending keys: ${pendingKeys}_`}
          aria-label={`Pending key sequence: ${pendingKeys}`}
        >
          {pendingKeys}_
        </span>
      )}
    </div>
  );
});

export default VimModeIndicator;
