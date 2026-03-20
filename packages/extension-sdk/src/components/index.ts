/**
 * Reusable UI components for extensions.
 *
 * All components use `React.createElement` (no JSX needed) and
 * CSS variables (`var(--xp-*)`) so they automatically match
 * whichever theme is active.
 *
 * @example
 * ```ts
 * import { Button, Input, Panel, Card, Spinner } from '@xplorer/extension-sdk';
 *
 * function MyPanel() {
 *   return Panel({ title: 'My Panel', children: [
 *     Card({ children: [
 *       Input({ placeholder: 'Search...', onChange: (v) => console.log(v) }),
 *       Button({ label: 'Go', variant: 'primary', onClick: () => {} }),
 *     ]}),
 *   ]});
 * }
 * ```
 */

// React is available as a global in the extension runtime
declare const React: typeof import('react');

// ─── Button ────────────────────────────────────────────────────────────────

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: Record<string, unknown>;
}

const BUTTON_VARIANTS: Record<string, Record<string, string>> = {
  primary: {
    background: 'var(--xp-blue, #7aa2f7)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: 'var(--xp-surface-light, #1e1e2e)',
    color: 'var(--xp-text, #c0caf5)',
    border: '1px solid var(--xp-border, #333)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--xp-text, #c0caf5)',
    border: 'none',
  },
  danger: {
    background: 'var(--xp-red, #f7768e)',
    color: '#fff',
    border: 'none',
  },
};

const BUTTON_SIZES: Record<string, Record<string, string | number>> = {
  sm: { padding: '4px 8px', fontSize: 11 },
  md: { padding: '6px 12px', fontSize: 13 },
  lg: { padding: '8px 16px', fontSize: 14 },
};

export const Button = (props: ButtonProps) => {
  const variant = props.variant || 'secondary';
  const size = props.size || 'md';

  return React.createElement(
    'button',
    {
      onClick: props.onClick,
      disabled: props.disabled,
      style: {
        ...BUTTON_VARIANTS[variant],
        ...BUTTON_SIZES[size],
        borderRadius: 4,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: 'opacity 0.15s, background 0.15s',
        fontFamily: 'inherit',
        lineHeight: 1.4,
        ...props.style,
      },
    },
    props.label,
  );
};

// ─── Input ─────────────────────────────────────────────────────────────────

export interface InputProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (e: unknown) => void;
  type?: string;
  disabled?: boolean;
  style?: Record<string, unknown>;
}

export const Input = (props: InputProps) => {
  return React.createElement('input', {
    type: props.type || 'text',
    value: props.value,
    placeholder: props.placeholder,
    disabled: props.disabled,
    onChange: (e: { target: { value: string } }) => props.onChange?.(e.target.value),
    onKeyDown: props.onKeyDown,
    style: {
      width: '100%',
      padding: '6px 10px',
      fontSize: 13,
      background: 'var(--xp-bg, #1a1b26)',
      color: 'var(--xp-text, #c0caf5)',
      border: '1px solid var(--xp-border, #333)',
      borderRadius: 4,
      outline: 'none',
      fontFamily: 'inherit',
      ...props.style,
    },
  });
};

// ─── Select ────────────────────────────────────────────────────────────────

export interface SelectProps {
  value?: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
  disabled?: boolean;
  style?: Record<string, unknown>;
}

export const Select = (props: SelectProps) => {
  return React.createElement(
    'select',
    {
      value: props.value,
      disabled: props.disabled,
      onChange: (e: { target: { value: string } }) => props.onChange?.(e.target.value),
      style: {
        width: '100%',
        padding: '6px 10px',
        fontSize: 13,
        background: 'var(--xp-bg, #1a1b26)',
        color: 'var(--xp-text, #c0caf5)',
        border: '1px solid var(--xp-border, #333)',
        borderRadius: 4,
        outline: 'none',
        fontFamily: 'inherit',
        ...props.style,
      },
    },
    ...props.options.map((opt) =>
      React.createElement('option', { key: opt.value, value: opt.value }, opt.label),
    ),
  );
};

// ─── Toggle ────────────────────────────────────────────────────────────────

export interface ToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Toggle = (props: ToggleProps) => {
  const checked = props.checked ?? false;
  return React.createElement(
    'label',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        color: 'var(--xp-text, #c0caf5)',
        opacity: props.disabled ? 0.5 : 1,
      },
    },
    React.createElement(
      'div',
      {
        onClick: () => !props.disabled && props.onChange?.(!checked),
        style: {
          width: 32,
          height: 18,
          borderRadius: 9,
          background: checked ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-surface-light, #1e1e2e)',
          border: '1px solid var(--xp-border, #333)',
          position: 'relative' as const,
          transition: 'background 0.15s',
          flexShrink: 0,
        },
      },
      React.createElement('div', {
        style: {
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute' as const,
          top: 1,
          left: checked ? 16 : 1,
          transition: 'left 0.15s',
        },
      }),
    ),
    props.label && React.createElement('span', null, props.label),
  );
};

// ─── Spinner ───────────────────────────────────────────────────────────────

export interface SpinnerProps {
  size?: number;
  color?: string;
}

export const Spinner = (props: SpinnerProps) => {
  const size = props.size || 20;
  const color = props.color || 'var(--xp-blue, #7aa2f7)';

  // Inject keyframes if not already present
  if (
    typeof document !== 'undefined' &&
    !document.getElementById('xplorer-sdk-spinner-keyframes')
  ) {
    const style = document.createElement('style');
    style.id = 'xplorer-sdk-spinner-keyframes';
    style.textContent = '@keyframes xplorer-sdk-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  return React.createElement('div', {
    style: {
      width: size,
      height: size,
      border: `2px solid transparent`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'xplorer-sdk-spin 0.6s linear infinite',
      display: 'inline-block',
    },
  });
};

// ─── Panel (layout wrapper) ────────────────────────────────────────────────

export interface PanelComponentProps {
  title?: string;
  children: React.ReactNode[];
  style?: Record<string, unknown>;
}

export const Panel = (props: PanelComponentProps) => {
  return React.createElement(
    'div',
    {
      style: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        color: 'var(--xp-text, #c0caf5)',
        fontSize: 13,
        ...props.style,
      },
    },
    props.title &&
      React.createElement(
        'div',
        {
          style: {
            padding: '8px 12px',
            borderBottom: '1px solid var(--xp-border, #333)',
            fontWeight: 600,
            fontSize: 12,
            flexShrink: 0,
          },
        },
        props.title,
      ),
    React.createElement(
      'div',
      {
        style: { flex: 1, overflow: 'auto', padding: '8px 12px' },
      },
      ...props.children,
    ),
  );
};

// ─── Card ──────────────────────────────────────────────────────────────────

export interface CardProps {
  children: React.ReactNode[];
  title?: string;
  style?: Record<string, unknown>;
}

export const Card = (props: CardProps) => {
  return React.createElement(
    'div',
    {
      style: {
        background: 'var(--xp-surface-light, #1e1e2e)',
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 8,
        ...props.style,
      },
    },
    props.title &&
      React.createElement(
        'div',
        {
          style: {
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--xp-text-muted, #888)',
            marginBottom: 8,
            textTransform: 'uppercase' as const,
          },
        },
        props.title,
      ),
    ...props.children,
  );
};
