import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

/** A toggle switch matching the original settings.tsx Toggle. */
export const Toggle = ({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-xp-bg ${
      checked ? 'bg-xp-accent' : 'bg-xp-border'
    }`}
    onClick={() => onChange(!checked)}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

/** A select dropdown field. */
export const SelectField = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-9 min-w-[140px]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

/** A single setting row: icon + label/desc on the left, control on the right. */
export const SettingRow = ({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon?: React.ElementType;
  label: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="group flex items-center justify-between gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
    <div className="flex items-center gap-3 min-w-0">
      {Icon && <Icon size={18} className="shrink-0 text-xp-text-secondary" />}
      <div className="min-w-0">
        <div className="text-sm font-medium text-xp-text">{label}</div>
        {description && (
          <div className="text-xs text-xp-text-secondary mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

/** Section heading. */
export const SectionTitle = ({ title, description }: { title: string; description?: string }) => (
  <div className="mb-1 px-4 pt-2 pb-1">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-xp-text-secondary">
      {title}
    </h3>
    {description && <p className="text-xs text-xp-text-secondary/70 mt-0.5">{description}</p>}
  </div>
);

/** Horizontal divider. */
export const Divider = () => <div className="mx-4 my-2 h-px bg-xp-border/50" />;

/** A single color picker field: label + native color input + hex text input. */
export const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex items-center gap-2 mb-2">
    <span className="w-[120px] text-[13px] text-xp-text-secondary shrink-0">{label}</span>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent shrink-0"
      style={{ WebkitAppearance: 'none' }}
    />
    <input
      type="text"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') onChange(v || '#000000');
      }}
      className="w-[90px] px-2 py-1 text-xs font-mono rounded border border-xp-border bg-xp-bg text-xp-text"
    />
  </div>
);

/** Permission toggle button (ON/OFF). */
export const PermToggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={onChange}
    className={`px-3 py-1 rounded-md text-xs font-semibold tracking-wide transition-all ${
      enabled
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
        : 'bg-red-500/10 text-red-400/70 border border-red-500/20 hover:bg-red-500/20'
    }`}
  >
    {enabled ? 'ON' : 'OFF'}
  </button>
);

// ── Shared types ──────────────────────────────────────────────────

export interface AppSettings {
  theme: string;
  showHiddenFiles: boolean;
  enableMarkdownPreview: boolean;
  defaultView: string;
  enableAnimations: boolean;
  showFileExtensions: boolean;
  enableNotifications: boolean;
  autoSave: boolean;
  fontSize: string;
  sidebarWidth: string;
  reducedMotion: boolean;
  enhancedFocus: boolean;
  autoCalculateFolderSizes: boolean;
  rememberViewPerFolder: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'glass',
  showHiddenFiles: false,
  enableMarkdownPreview: true,
  defaultView: 'grid',
  enableAnimations: true,
  showFileExtensions: true,
  enableNotifications: true,
  autoSave: true,
  fontSize: 'medium',
  sidebarWidth: 'medium',
  reducedMotion: false,
  enhancedFocus: false,
  autoCalculateFolderSizes: false,
  rememberViewPerFolder: false,
};

export const SETTINGS_KEY = 'xplorer:settings';
