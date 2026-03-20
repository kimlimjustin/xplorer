import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import TokenizerSettings from '@/components/TokenizerSettings';
import KeyboardShortcutsSettings from '@/components/KeyboardShortcutsSettings';
import { startTour, resetTourCompleted } from '@/hooks/use-tour';
import { resetBetaWarning } from '@/components/dialogs/BetaWarningDialog';
import {
  isVimModeEnabled,
  setVimModeSetting,
  isVimLearningModeEnabled,
  setVimLearningModeSetting,
} from '@/hooks/use-vim-mode';
import { AgentService, type AgentSettings, type AgentPermissions } from '@/lib/agent-service';
import { applyFontSize, loadFontSize } from '@/lib/utils';
import { useAllThemes } from '@/lib/theme-registry';
import {
  ArrowLeft,
  Palette,
  FolderOpen,
  Bot,
  Brain,
  Search,
  Accessibility,
  Monitor,
  Type,
  PanelLeft,
  Sparkles,
  Eye,
  EyeOff,
  FileText,
  LayoutGrid,
  Bell,
  Save,
  Shield,
  Key,
  Cpu,
  RotateCcw,
  ChevronRight,
  Settings2,
  SlidersHorizontal,
  Keyboard,
  HelpCircle,
  AlertTriangle,
  Store,
  Globe,
  HardDrive,
  ClipboardList,
  History,
  MousePointerClick,
} from 'lucide-react';
import BackupRestoreSettings from '@/components/settings/BackupRestoreSettings';
import AuditLogSettings from '@/components/settings/AuditLogSettings';
import VersioningSettings from '@/components/settings/VersioningSettings';
import ContextMenuRulesCard from '@/components/settings/ContextMenuRulesCard';
import { TauriAPI } from '@/lib/tauri-api';

type SettingsTab =
  | 'general'
  | 'explorer'
  | 'context-menu'
  | 'ai'
  | 'permissions'
  | 'indexing'
  | 'shortcuts'
  | 'accessibility'
  | 'marketplace'
  | 'backup'
  | 'audit'
  | 'versioning';

const tabs: { id: SettingsTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'general', label: 'General', icon: Settings2, description: 'Appearance, layout & system' },
  { id: 'explorer', label: 'File Explorer', icon: FolderOpen, description: 'Views & file display' },
  {
    id: 'context-menu',
    label: 'Context Menu',
    icon: MousePointerClick,
    description: 'Right-click menu rules',
  },
  { id: 'ai', label: 'AI Agent', icon: Bot, description: 'Claude integration' },
  {
    id: 'permissions',
    label: 'Permissions',
    icon: Shield,
    description: 'Agent tool & path access',
  },
  { id: 'indexing', label: 'Indexing', icon: Search, description: 'File search & tokenizer' },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, description: 'Key bindings & profiles' },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: Store,
    description: 'Extension marketplace URL',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    icon: Accessibility,
    description: 'Motion & focus',
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    icon: HardDrive,
    description: 'Import & export settings',
  },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList, description: 'File operation history' },
  { id: 'versioning', label: 'Versioning', icon: History, description: 'File version history' },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const allThemes = useAllThemes();

  // Vim mode toggle (stored in its own localStorage key)
  const [vimModeEnabled, setVimModeEnabledState] = useState(() => isVimModeEnabled());
  const handleVimModeToggle = (v: boolean) => {
    setVimModeEnabledState(v);
    setVimModeSetting(v);
  };
  const [vimLearningMode, setVimLearningModeState] = useState(() => isVimLearningModeEnabled());
  const handleVimLearningModeToggle = (v: boolean) => {
    setVimLearningModeState(v);
    setVimLearningModeSetting(v);
  };

  const { t, i18n } = useTranslation();

  const SETTINGS_KEY = 'xplorer:settings';
  const defaultSettings = {
    theme: 'glass',
    language: '',
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
  };

  const [settings, setSettings] = useState<typeof defaultSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
    } catch { /* ignore localStorage/parse errors */ }
    return defaultSettings;
  });

  const MARKETPLACE_KEY = 'xplorer:marketplace-url';
  const defaultMarketplaceUrl = 'http://localhost:3000/api';
  const [marketplaceUrl, setMarketplaceUrl] = useState(() => {
    try {
      return localStorage.getItem(MARKETPLACE_KEY) || defaultMarketplaceUrl;
    } catch {
      return defaultMarketplaceUrl;
    }
  });

  useEffect(() => {
    localStorage.setItem(MARKETPLACE_KEY, marketplaceUrl);
  }, [marketplaceUrl]);

  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    enabled: true,
    api_key: '',
    openai_api_key: '',
    model: 'claude-sonnet-4-6',
    max_turns: 25,
    auto_approve: false,
    thinking_enabled: false,
    thinking_budget: 10000,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [agentSettingsLoaded, setAgentSettingsLoaded] = useState(false);

  const [permissions, setPermissions] = useState<AgentPermissions>({
    disabled_tools: [],
    auto_approve_tools: [],
    allowed_paths: [],
    blocked_paths: [],
    custom_blocked_commands: [],
    block_internet: true,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    AgentService.getSettings()
      .then((s) => {
        setAgentSettings(s);
        setAgentSettingsLoaded(true);
      })
      .catch(() => {
        setAgentSettingsLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!agentSettingsLoaded) return;
    const timer = setTimeout(() => {
      AgentService.updateSettings(agentSettings).catch(console.error);
    }, 500);
    return () => clearTimeout(timer);
  }, [agentSettings, agentSettingsLoaded]);

  const updateAgentSetting = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
    setAgentSettings((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    AgentService.getPermissions()
      .then((p) => {
        setPermissions(p);
        setPermissionsLoaded(true);
      })
      .catch(() => setPermissionsLoaded(true));
  }, []);

  useEffect(() => {
    if (!permissionsLoaded) return;
    const timer = setTimeout(() => {
      AgentService.updatePermissions(permissions).catch(console.error);
    }, 500);
    return () => clearTimeout(timer);
  }, [permissions, permissionsLoaded]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    loadFontSize();
    if (settings.reducedMotion) document.documentElement.classList.add('reduce-motion');
    if (settings.enhancedFocus) document.documentElement.classList.add('enhanced-focus');
    // Mount-only: apply persisted accessibility settings on init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSetting = (key: string, value: string | boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const themes = Object.entries(allThemes).map(([key, th]) => ({
    value: key,
    label: th.name,
  }));

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' },
    { value: 'id', label: 'Bahasa Indonesia' },
  ];

  const viewModes = [
    { value: 'grid', label: 'Grid' },
    { value: 'list', label: 'List' },
    { value: 'details', label: 'Details' },
  ];

  const fontSizes = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
    { value: 'xl', label: 'Extra Large' },
  ];

  const sidebarWidths = [
    { value: 'narrow', label: 'Narrow' },
    { value: 'medium', label: 'Medium' },
    { value: 'wide', label: 'Wide' },
  ];

  // ── Reusable sub-components ──────────────────────────────────────

  const Toggle = ({
    checked,
    onChange,
    id,
    label,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    id: string;
    label?: string;
  }) => (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
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

  const SelectField = ({
    value,
    onChange,
    options,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    label?: string;
  }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 min-w-[140px]" aria-label={label}>
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

  /** A single setting row: icon + label/desc on the left, control on the right */
  const SettingRow = ({
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
            <div className="text-xs text-xp-text-secondary mt-0.5 leading-relaxed">
              {description}
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  const SectionTitle = ({ title, description }: { title: string; description?: string }) => (
    <div className="mb-1 px-4 pt-2 pb-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-xp-text-secondary">
        {title}
      </h3>
      {description && <p className="text-xs text-xp-text-secondary/70 mt-0.5">{description}</p>}
    </div>
  );

  const Divider = () => <div className="mx-4 my-2 h-px bg-xp-border/50" />;

  const SystemIntegrationSettings = () => {
    const [isDefaultHandler, setIsDefaultHandler] = useState(false);
    const [contextMenuInstalled, setContextMenuInstalled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isWindows] = useState(() => navigator.userAgent.includes('Windows'));

    useEffect(() => {
      if (!isWindows) { setLoading(false); return; }
      TauriAPI.getShellIntegrationStatus()
        .then((status) => {
          setIsDefaultHandler(status.is_default_handler);
          setContextMenuInstalled(status.context_menu_installed);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [isWindows]);

    if (!isWindows) return null;
    if (loading) return <div className="px-4 py-2 text-sm text-xp-text-muted">Loading...</div>;

    return (
      <>
        <SettingRow
          icon={Monitor}
          label="Default File Explorer"
          description="Double-clicking folders opens Xplorer instead of Windows Explorer"
        >
          <Toggle
            id="defaultExplorer"
            label="Default Explorer"
            checked={isDefaultHandler}
            onChange={async (v) => {
              try {
                await TauriAPI.setDefaultFolderHandler(v);
                setIsDefaultHandler(v);
                if (v && !contextMenuInstalled) {
                  setContextMenuInstalled(true);
                }
              } catch (err) {
                console.error('Failed to set default handler:', err);
              }
            }}
          />
        </SettingRow>
        <SettingRow
          icon={FolderOpen}
          label="Folder Context Menu"
          description="Add 'Open with Xplorer' to folder right-click menu"
        >
          <Toggle
            id="contextMenu"
            label="Context Menu"
            checked={contextMenuInstalled}
            onChange={async (v) => {
              try {
                if (v) {
                  await TauriAPI.addContextMenuEntry();
                } else {
                  await TauriAPI.removeContextMenuEntry();
                  if (isDefaultHandler) {
                    await TauriAPI.setDefaultFolderHandler(false);
                    setIsDefaultHandler(false);
                  }
                }
                setContextMenuInstalled(v);
              } catch (err) {
                console.error('Failed to toggle context menu:', err);
              }
            }}
          />
        </SettingRow>
        {isDefaultHandler && (
          <div className="px-4 py-2 text-xs text-amber-400 flex items-center gap-2">
            <AlertTriangle size={12} />
            Folders will open in Xplorer. Disable to restore Windows Explorer.
          </div>
        )}
      </>
    );
  };

  // ── Tab Content Renderers ────────────────────────────────────────

  const renderGeneral = () => (
    <div className="space-y-1">
      <SectionTitle title="Appearance" />
      <SettingRow icon={Palette} label="Theme" description="Color scheme for the application">
        <SelectField
          label="Theme"
          value={settings.theme}
          onChange={(v) => updateSetting('theme', v)}
          options={themes}
        />
      </SettingRow>
      <SettingRow icon={Globe} label={t('settings.general.language')} description={t('settings.general.languageDesc')}>
        <SelectField
          label="Language"
          value={settings.language || i18n.language?.split('-')[0] || 'en'}
          onChange={(v) => {
            updateSetting('language', v);
            i18n.changeLanguage(v);
          }}
          options={languageOptions}
        />
      </SettingRow>
      <SettingRow icon={Type} label="Font Size" description="Base font size across the UI">
        <SelectField
          label="Font Size"
          value={settings.fontSize}
          onChange={(v) => {
            updateSetting('fontSize', v);
            applyFontSize(v as 'small' | 'medium' | 'large' | 'xl');
          }}
          options={fontSizes}
        />
      </SettingRow>
      <SettingRow
        icon={Sparkles}
        label="Animations"
        description="Enable smooth transitions and effects"
      >
        <Toggle
          id="animations"
          label="Animations"
          checked={settings.enableAnimations}
          onChange={(v) => updateSetting('enableAnimations', v)}
        />
      </SettingRow>

      <Divider />
      <SectionTitle title="Layout" />
      <SettingRow
        icon={PanelLeft}
        label="Sidebar Width"
        description="Width of the navigation sidebar"
      >
        <SelectField
          label="Sidebar Width"
          value={settings.sidebarWidth}
          onChange={(v) => updateSetting('sidebarWidth', v)}
          options={sidebarWidths}
        />
      </SettingRow>

      <Divider />
      <SectionTitle title="System" />
      <SettingRow
        icon={Bell}
        label="Notifications"
        description="Show desktop notifications for events"
      >
        <Toggle
          id="notifications"
          label="Notifications"
          checked={settings.enableNotifications}
          onChange={(v) => updateSetting('enableNotifications', v)}
        />
      </SettingRow>
      <SettingRow icon={Save} label="Auto Save" description="Automatically save changes to files">
        <Toggle
          id="autoSave"
          label="Auto Save"
          checked={settings.autoSave}
          onChange={(v) => updateSetting('autoSave', v)}
        />
      </SettingRow>

      <Divider />
      <SectionTitle title="System Integration" />
      <SystemIntegrationSettings />

      <Divider />
      <SectionTitle title="Help" />
      <SettingRow
        icon={HelpCircle}
        label="Onboarding Tour"
        description="Replay the interactive guided tour of the app"
      >
        <button
          onClick={() => {
            resetTourCompleted();
            setLocation('/');
            setTimeout(() => startTour(), 300);
          }}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-xp-blue text-white hover:opacity-90 transition-opacity"
        >
          Replay Tour
        </button>
      </SettingRow>
      <SettingRow
        icon={AlertTriangle}
        label="Beta Warning"
        description="Show the early beta warning dialog again"
      >
        <button
          onClick={() => {
            resetBetaWarning();
            setLocation('/');
          }}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-amber-500 text-white hover:opacity-90 transition-opacity"
        >
          Show Warning
        </button>
      </SettingRow>

      <Divider />
      <div className="px-4 pt-4">
        <button
          onClick={() => setSettings(defaultSettings)}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-xp-red transition-colors hover:bg-xp-red/10"
        >
          <RotateCcw size={14} />
          Reset all settings to defaults
        </button>
      </div>
    </div>
  );

  const renderExplorer = () => (
    <div className="space-y-1">
      <SectionTitle title="Display" />
      <SettingRow
        icon={LayoutGrid}
        label="Default View"
        description="How files are displayed by default"
      >
        <SelectField
          label="Default View"
          value={settings.defaultView}
          onChange={(v) => updateSetting('defaultView', v)}
          options={viewModes}
        />
      </SettingRow>
      <SettingRow
        icon={Eye}
        label="Show Hidden Files"
        description="Display files starting with a dot"
      >
        <Toggle
          id="hiddenFiles"
          label="Show Hidden Files"
          checked={settings.showHiddenFiles}
          onChange={(v) => updateSetting('showHiddenFiles', v)}
        />
      </SettingRow>
      <SettingRow
        icon={FileText}
        label="File Extensions"
        description="Show file type extensions in names"
      >
        <Toggle
          id="fileExtensions"
          label="File Extensions"
          checked={settings.showFileExtensions}
          onChange={(v) => updateSetting('showFileExtensions', v)}
        />
      </SettingRow>
      <SettingRow
        icon={FolderOpen}
        label="Auto-Calculate Folder Sizes"
        description="Automatically calculate and display folder sizes in details view"
      >
        <Toggle
          id="autoFolderSizes"
          label="Auto-Calculate Folder Sizes"
          checked={settings.autoCalculateFolderSizes}
          onChange={(v) => updateSetting('autoCalculateFolderSizes', v)}
        />
      </SettingRow>

      <Divider />
      <SectionTitle title="Preview" />
      <SettingRow
        icon={FileText}
        label="Markdown Preview"
        description="Render markdown files instead of showing raw text"
      >
        <Toggle
          id="markdownPreview"
          label="Markdown Preview"
          checked={settings.enableMarkdownPreview}
          onChange={(v) => updateSetting('enableMarkdownPreview', v)}
        />
      </SettingRow>
    </div>
  );

  const renderContextMenu = () => <ContextMenuRulesCard />;

  const renderAI = () => (
    <div className="space-y-1">
      <SectionTitle title="Agent" />
      <SettingRow
        icon={Bot}
        label="Enable Agent"
        description="Activate AI-powered file management assistant"
      >
        <Toggle
          id="agentEnabled"
          label="Enable Agent"
          checked={agentSettings.enabled}
          onChange={(v) => updateAgentSetting('enabled', v)}
        />
      </SettingRow>
      <SettingRow
        icon={Shield}
        label="Auto-Approve Actions"
        description={
          agentSettings.auto_approve
            ? 'Writes, deletes, and commands run without asking'
            : 'Destructive actions require your approval'
        }
      >
        <Toggle
          id="autoApprove"
          label="Auto-Approve Agent Actions"
          checked={agentSettings.auto_approve}
          onChange={(v) => updateAgentSetting('auto_approve', v)}
        />
      </SettingRow>

      <Divider />
      <SectionTitle title="Configuration" />

      {/* API Key — special layout */}
      <div className="rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
        <div className="flex items-center gap-3 mb-2">
          <Key size={18} className="shrink-0 text-xp-text-secondary" />
          <div>
            <div className="text-sm font-medium text-xp-text">API Key</div>
            <div className="text-xs text-xp-text-secondary mt-0.5">
              Your Anthropic Claude API key
            </div>
          </div>
        </div>
        <div className="relative ml-[30px]">
          <input
            id="apiKey"
            type={showApiKey ? 'text' : 'password'}
            value={agentSettings.api_key}
            onChange={(e) => updateAgentSetting('api_key', e.target.value)}
            placeholder="sk-ant-..."
            className="w-full h-9 rounded-md border border-xp-border bg-xp-bg px-3 pr-16 text-sm text-xp-text transition-colors hover:border-xp-text-secondary focus:border-xp-accent focus:outline-none focus:ring-1 focus:ring-xp-accent font-mono"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded px-2 py-1 text-xs text-xp-text-secondary transition-colors hover:text-xp-text hover:bg-xp-surface-light"
          >
            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            {showApiKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <SettingRow icon={Cpu} label="Model" description="Which AI model to use for the agent">
        <SelectField
          label="AI Model"
          value={agentSettings.model}
          onChange={(v) => updateAgentSetting('model', v)}
          options={[
            { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
            { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
            { value: 'gpt-4.1', label: 'GPT-4.1' },
            { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
            { value: 'o3-mini', label: 'o3-mini' },
          ]}
        />
      </SettingRow>

      {/* OpenAI API Key — shows when an OpenAI model is selected */}
      {(agentSettings.model.startsWith('gpt-') ||
        agentSettings.model.startsWith('o1') ||
        agentSettings.model.startsWith('o3') ||
        agentSettings.model.startsWith('o4') ||
        agentSettings.model.startsWith('chatgpt-')) && (
        <div className="rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
          <div className="flex items-center gap-3 mb-2">
            <Key size={18} className="shrink-0 text-xp-text-secondary" />
            <div>
              <div className="text-sm font-medium text-xp-text">OpenAI API Key</div>
              <div className="text-xs text-xp-text-secondary mt-0.5">
                Required for GPT / OpenAI models
              </div>
            </div>
          </div>
          <div className="relative ml-[30px]">
            <input
              type={showOpenaiKey ? 'text' : 'password'}
              value={agentSettings.openai_api_key}
              onChange={(e) => updateAgentSetting('openai_api_key', e.target.value)}
              placeholder="sk-..."
              className="w-full h-9 rounded-md border border-xp-border bg-xp-bg px-3 pr-16 text-sm text-xp-text transition-colors hover:border-xp-text-secondary focus:border-xp-accent focus:outline-none focus:ring-1 focus:ring-xp-accent font-mono"
            />
            <button
              type="button"
              onClick={() => setShowOpenaiKey(!showOpenaiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded px-2 py-1 text-xs text-xp-text-secondary transition-colors hover:text-xp-text hover:bg-xp-surface-light"
            >
              {showOpenaiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              {showOpenaiKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      )}

      <Divider />
      <SectionTitle title="AI Search" />

      {/* OpenAI API Key for search */}
      <div className="rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
        <div className="flex items-center gap-3 mb-2">
          <Key size={18} className="shrink-0 text-xp-text-secondary" />
          <div>
            <div className="text-sm font-medium text-xp-text">OpenAI API Key</div>
            <div className="text-xs text-xp-text-secondary mt-0.5">
              For GPT-powered search (optional)
            </div>
          </div>
        </div>
        <div className="ml-[30px]">
          <input
            type="password"
            defaultValue={localStorage.getItem('xplorer_openai_key') || ''}
            onChange={(e) => localStorage.setItem('xplorer_openai_key', e.target.value)}
            placeholder="sk-..."
            className="w-full h-9 rounded-md border border-xp-border bg-xp-bg px-3 text-sm text-xp-text transition-colors hover:border-xp-text-secondary focus:border-xp-accent focus:outline-none focus:ring-1 focus:ring-xp-accent font-mono"
          />
        </div>
      </div>

      {/* Ollama URL */}
      <div className="rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
        <div className="flex items-center gap-3 mb-2">
          <Cpu size={18} className="shrink-0 text-xp-text-secondary" />
          <div>
            <div className="text-sm font-medium text-xp-text">Ollama Endpoint</div>
            <div className="text-xs text-xp-text-secondary mt-0.5">
              Local Ollama server URL for AI search
            </div>
          </div>
        </div>
        <div className="ml-[30px]">
          <input
            type="text"
            defaultValue={localStorage.getItem('xplorer_ollama_url') || 'http://localhost:11434'}
            onChange={(e) => localStorage.setItem('xplorer_ollama_url', e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full h-9 rounded-md border border-xp-border bg-xp-bg px-3 text-sm text-xp-text transition-colors hover:border-xp-text-secondary focus:border-xp-accent focus:outline-none focus:ring-1 focus:ring-xp-accent font-mono"
          />
        </div>
      </div>

      <Divider />
      <SectionTitle title="Agent" />

      {/* Max Turns — special layout */}
      <div className="rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SlidersHorizontal size={18} className="shrink-0 text-xp-text-secondary" />
            <div>
              <div className="text-sm font-medium text-xp-text">Max Turns</div>
              <div className="text-xs text-xp-text-secondary mt-0.5">
                Maximum conversation turns per task
              </div>
            </div>
          </div>
          <span className="text-sm font-medium text-xp-accent tabular-nums">
            {agentSettings.max_turns}
          </span>
        </div>
        <div className="ml-[30px] mt-2">
          <input
            id="maxTurns"
            type="range"
            min={5}
            max={50}
            value={agentSettings.max_turns}
            onChange={(e) => updateAgentSetting('max_turns', Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-xp-border accent-xp-accent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-xp-accent [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex justify-between text-[10px] text-xp-text-secondary/60 mt-1">
            <span>5</span>
            <span>50</span>
          </div>
        </div>
      </div>

      {/* Thinking Mode */}
      <SettingRow
        icon={Brain}
        label="Extended Thinking"
        description="Enable deeper reasoning for complex tasks (Claude only)"
      >
        <Toggle
          id="thinkingEnabled"
          label="Extended Thinking"
          checked={agentSettings.thinking_enabled}
          onChange={(v) => updateAgentSetting('thinking_enabled', v)}
        />
      </SettingRow>

      {/* Thinking Budget — conditional */}
      {agentSettings.thinking_enabled && (
        <div className="rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SlidersHorizontal size={18} className="shrink-0 text-xp-text-secondary" />
              <div>
                <div className="text-sm font-medium text-xp-text">Thinking Budget</div>
                <div className="text-xs text-xp-text-secondary mt-0.5">
                  Max tokens for reasoning
                </div>
              </div>
            </div>
            <span className="text-sm font-medium text-xp-accent tabular-nums">
              {agentSettings.thinking_budget.toLocaleString()}
            </span>
          </div>
          <div className="ml-[30px] mt-2">
            <input
              type="range"
              min={5000}
              max={50000}
              step={5000}
              value={agentSettings.thinking_budget}
              onChange={(e) => updateAgentSetting('thinking_budget', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-xp-border accent-xp-accent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-xp-accent [&::-webkit-slider-thumb]:shadow-md"
            />
            <div className="flex justify-between text-[10px] text-xp-text-secondary/60 mt-1">
              <span>5K</span>
              <span>50K</span>
            </div>
          </div>
        </div>
      )}

      <Divider />
      <div className="px-4 pt-2">
        <button
          onClick={() => {
            setAgentSettings({
              enabled: true,
              api_key: agentSettings.api_key,
              openai_api_key: agentSettings.openai_api_key,
              model: 'claude-sonnet-4-6',
              max_turns: 25,
              auto_approve: false,
              thinking_enabled: false,
              thinking_budget: 10000,
            });
          }}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-xp-text-secondary transition-colors hover:text-xp-text hover:bg-xp-surface-light"
        >
          <RotateCcw size={14} />
          Reset agent settings
        </button>
      </div>
    </div>
  );

  const ALL_TOOLS = {
    read: [
      { name: 'read_file', label: 'Read File', desc: 'Read file contents' },
      { name: 'list_directory', label: 'List Directory', desc: 'List files in a directory' },
      { name: 'search_files', label: 'Search Files', desc: 'Glob pattern file search' },
      { name: 'search_content', label: 'Search Content', desc: 'Regex search in file contents' },
      { name: 'get_system_info', label: 'System Info', desc: 'OS and system details' },
      { name: 'search_indexed', label: 'Search Index', desc: 'Search pre-built file index' },
      { name: 'extract_document_text', label: 'Extract Text', desc: 'Extract text from documents' },
      { name: 'recall', label: 'Recall Memory', desc: 'Retrieve stored memories' },
    ],
    write: [
      { name: 'write_file', label: 'Write File', desc: 'Create or overwrite files' },
      { name: 'create_directory', label: 'Create Directory', desc: 'Create directories' },
      { name: 'rename', label: 'Rename', desc: 'Rename files or directories' },
      { name: 'delete', label: 'Delete', desc: 'Move to trash' },
      { name: 'move_file', label: 'Move File', desc: 'Move files or directories' },
      { name: 'copy_file', label: 'Copy File', desc: 'Copy files or directories' },
      { name: 'execute_command', label: 'Execute Command', desc: 'Run shell commands' },
      { name: 'execute_plan', label: 'Execute Plan', desc: 'Execute approved plans' },
    ],
  };

  const toggleTool = (toolName: string) => {
    setPermissions((prev) => {
      const disabled = prev.disabled_tools.includes(toolName)
        ? prev.disabled_tools.filter((t) => t !== toolName)
        : [...prev.disabled_tools, toolName];
      return { ...prev, disabled_tools: disabled };
    });
  };

  const toggleAutoApprove = (toolName: string) => {
    setPermissions((prev) => {
      const list = prev.auto_approve_tools.includes(toolName)
        ? prev.auto_approve_tools.filter((t) => t !== toolName)
        : [...prev.auto_approve_tools, toolName];
      return { ...prev, auto_approve_tools: list };
    });
  };

  const addToList = (
    field: 'allowed_paths' | 'blocked_paths' | 'custom_blocked_commands',
    value: string,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPermissions((prev) => {
      if (prev[field].includes(trimmed)) return prev;
      return { ...prev, [field]: [...prev[field], trimmed] };
    });
  };

  const removeFromList = (
    field: 'allowed_paths' | 'blocked_paths' | 'custom_blocked_commands',
    index: number,
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const PermToggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
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

  const renderPermissions = () => (
    <div className="space-y-1">
      {/* Internet Sandbox */}
      <SectionTitle title="Network" />
      <div className="flex items-center justify-between gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
        <div className="flex items-center gap-3 min-w-0">
          <Globe size={18} className="shrink-0 text-xp-text-secondary" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-xp-text">Block Internet Access</div>
            <div className="text-xs text-xp-text-secondary mt-0.5 leading-relaxed">
              Prevent the agent from running commands that access the network (ping, ftp, telnet,
              nslookup, URLs in arguments, etc.). Core network tools (curl, wget, ssh, nc) are
              always blocked regardless of this setting.
            </div>
          </div>
        </div>
        <PermToggle
          enabled={permissions.block_internet}
          onChange={() =>
            setPermissions((prev) => ({ ...prev, block_internet: !prev.block_internet }))
          }
        />
      </div>

      <Divider />

      {/* Tool Access */}
      <SectionTitle title="Read Tools" description="Tools that run without approval" />
      <div className="grid grid-cols-1 gap-0.5">
        {ALL_TOOLS.read.map((tool) => {
          const enabled = !permissions.disabled_tools.includes(tool.name);
          return (
            <div
              key={tool.name}
              className={`flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 transition-colors hover:bg-xp-surface-light/50 ${!enabled ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-xp-text flex items-center gap-2">
                  <code className="text-[11px] bg-xp-surface px-1.5 py-0.5 rounded text-xp-accent/80 font-mono">
                    {tool.name}
                  </code>
                  {tool.label}
                </div>
                <div className="text-xs text-xp-text-secondary mt-0.5">{tool.desc}</div>
              </div>
              <PermToggle enabled={enabled} onChange={() => toggleTool(tool.name)} />
            </div>
          );
        })}
      </div>

      <Divider />
      <SectionTitle
        title="Write Tools"
        description="Tools that modify files (require approval by default)"
      />
      <div className="grid grid-cols-1 gap-0.5">
        {ALL_TOOLS.write.map((tool) => {
          const enabled = !permissions.disabled_tools.includes(tool.name);
          return (
            <div
              key={tool.name}
              className={`flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 transition-colors hover:bg-xp-surface-light/50 ${!enabled ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-xp-text flex items-center gap-2">
                  <code className="text-[11px] bg-xp-surface px-1.5 py-0.5 rounded text-xp-accent/80 font-mono">
                    {tool.name}
                  </code>
                  {tool.label}
                </div>
                <div className="text-xs text-xp-text-secondary mt-0.5">{tool.desc}</div>
              </div>
              <PermToggle enabled={enabled} onChange={() => toggleTool(tool.name)} />
            </div>
          );
        })}
      </div>

      {/* Per-tool auto-approve */}
      <Divider />
      <SectionTitle
        title="Auto-Approve Rules"
        description={
          agentSettings.auto_approve
            ? 'Global auto-approve is ON — all write tools skip approval'
            : 'Skip the approval prompt for specific write tools'
        }
      />
      {agentSettings.auto_approve ? (
        <div className="px-4 py-2 text-xs text-xp-text-secondary italic">
          Global auto-approve is enabled. Disable it in AI Agent settings to use per-tool rules.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0.5">
          {ALL_TOOLS.write.map((tool) => {
            const isDisabled = permissions.disabled_tools.includes(tool.name);
            if (isDisabled) return null;
            const autoApproved = permissions.auto_approve_tools.includes(tool.name);
            return (
              <div
                key={tool.name}
                className="flex items-center justify-between gap-4 rounded-lg px-4 py-2 transition-colors hover:bg-xp-surface-light/50"
              >
                <div className="text-sm text-xp-text">{tool.label}</div>
                <PermToggle enabled={autoApproved} onChange={() => toggleAutoApprove(tool.name)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Path Restrictions */}
      <Divider />
      <SectionTitle
        title="Allowed Paths"
        description="If set, the agent can ONLY access these directories"
      />
      <div className="px-4 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. D:\Projects"
            className="flex-1 h-8 rounded-md border border-xp-border bg-xp-bg px-3 text-sm text-xp-text focus:border-xp-accent focus:outline-none focus:ring-1 focus:ring-xp-accent font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addToList('allowed_paths', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addToList('allowed_paths', input.value);
              input.value = '';
            }}
            className="h-8 px-3 rounded-md text-xs font-medium bg-xp-accent text-white hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
        {permissions.allowed_paths.length > 0 && (
          <div className="space-y-1">
            {permissions.allowed_paths.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-xp-surface px-3 py-1.5 text-sm font-mono text-xp-text"
              >
                <span className="truncate">{p}</span>
                <button
                  onClick={() => removeFromList('allowed_paths', i)}
                  className="text-xp-text-secondary hover:text-red-400 text-xs shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Divider />
      <SectionTitle
        title="Blocked Paths"
        description="Additional paths blocked beyond system defaults"
      />
      <div className="px-4 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. D:\Secrets"
            className="flex-1 h-8 rounded-md border border-xp-border bg-xp-bg px-3 text-sm text-xp-text focus:border-xp-accent focus:outline-none focus:ring-1 focus:ring-xp-accent font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addToList('blocked_paths', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addToList('blocked_paths', input.value);
              input.value = '';
            }}
            className="h-8 px-3 rounded-md text-xs font-medium bg-xp-accent text-white hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
        {permissions.blocked_paths.length > 0 && (
          <div className="space-y-1">
            {permissions.blocked_paths.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-xp-surface px-3 py-1.5 text-sm font-mono text-xp-text"
              >
                <span className="truncate">{p}</span>
                <button
                  onClick={() => removeFromList('blocked_paths', i)}
                  className="text-xp-text-secondary hover:text-red-400 text-xs shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocked Commands */}
      <Divider />
      <SectionTitle
        title="Custom Blocked Commands"
        description="Added on top of 60+ built-in blocked commands"
      />
      <div className="px-4 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. npm"
            className="flex-1 h-8 rounded-md border border-xp-border bg-xp-bg px-3 text-sm text-xp-text focus:border-xp-accent focus:outline-none focus:ring-1 focus:ring-xp-accent font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addToList('custom_blocked_commands', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addToList('custom_blocked_commands', input.value);
              input.value = '';
            }}
            className="h-8 px-3 rounded-md text-xs font-medium bg-xp-accent text-white hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
        {permissions.custom_blocked_commands.length > 0 && (
          <div className="space-y-1">
            {permissions.custom_blocked_commands.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-xp-surface px-3 py-1.5 text-sm font-mono text-xp-text"
              >
                <span className="truncate">{c}</span>
                <button
                  onClick={() => removeFromList('custom_blocked_commands', i)}
                  className="text-xp-text-secondary hover:text-red-400 text-xs shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset */}
      <Divider />
      <div className="px-4 pt-2">
        <button
          onClick={() => {
            setPermissions({
              disabled_tools: [],
              auto_approve_tools: [],
              allowed_paths: [],
              blocked_paths: [],
              custom_blocked_commands: [],
              block_internet: true,
            });
          }}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-xp-text-secondary transition-colors hover:text-xp-text hover:bg-xp-surface-light"
        >
          <RotateCcw size={14} />
          Reset to defaults
        </button>
      </div>
    </div>
  );

  const renderIndexing = () => (
    <div className="px-4 py-2">
      <TokenizerSettings />
    </div>
  );

  const renderAccessibility = () => (
    <div className="space-y-1">
      <SectionTitle title="Motion" />
      <SettingRow
        icon={Sparkles}
        label="Reduce Motion"
        description="Disable animations and transitions for comfort"
      >
        <Toggle
          id="reducedMotion"
          label="Reduce Motion"
          checked={settings.reducedMotion}
          onChange={(v) => {
            updateSetting('reducedMotion', v);
            document.documentElement.classList.toggle('reduce-motion', v);
          }}
        />
      </SettingRow>

      <Divider />
      <SectionTitle title="Focus" />
      <SettingRow
        icon={Monitor}
        label="Enhanced Focus Indicators"
        description="Show strong outlines for keyboard navigation"
      >
        <Toggle
          id="enhancedFocus"
          label="Enhanced Focus Indicators"
          checked={settings.enhancedFocus}
          onChange={(v) => {
            updateSetting('enhancedFocus', v);
            document.documentElement.classList.toggle('enhanced-focus', v);
          }}
        />
      </SettingRow>
    </div>
  );

  const renderShortcuts = () => (
    <div className="space-y-1">
      <SectionTitle title="Input Mode" />
      <SettingRow
        icon={Keyboard}
        label="Vim Mode"
        description="Navigate files with vim-like keys (j/k/h/l, gg, G, dd, yy, p, v)"
      >
        <Toggle id="vimMode" label="Vim Mode" checked={vimModeEnabled} onChange={handleVimModeToggle} />
      </SettingRow>
      {vimModeEnabled && (
        <>
          <SettingRow
            icon={Keyboard}
            label="Vim Learning Mode"
            description="Show key binding hints in the status bar when Vim mode is active"
          >
            <Toggle
              id="vimLearningMode"
              label="Vim Learning Mode"
              checked={vimLearningMode}
              onChange={handleVimLearningModeToggle}
            />
          </SettingRow>
          <div className="mx-4 mb-2 rounded-md bg-xp-surface-light/50 p-3 text-xs text-xp-text-secondary leading-relaxed space-y-1">
            <div className="font-medium text-xp-text text-sm mb-1.5">Vim Key Bindings</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">j</kbd> /{' '}
                <kbd className="font-mono bg-xp-bg px-1 rounded">k</kbd> Move down / up
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">h</kbd> Go to parent
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">l</kbd> /{' '}
                <kbd className="font-mono bg-xp-bg px-1 rounded">Enter</kbd> Open / enter
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">gg</kbd> First file
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">G</kbd> Last file
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">/</kbd> Focus search
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">:</kbd> Command palette
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">i</kbd> Insert mode
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">dd</kbd> Delete
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">yy</kbd> Copy (yank)
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">p</kbd> Paste
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">v</kbd> Visual mode
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">V</kbd> Select range
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">o</kbd> Open with default
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">r</kbd> Rename
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">m</kbd> Bookmark dir
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">.</kbd> Repeat last
              </span>
              <span>
                <kbd className="font-mono bg-xp-bg px-1 rounded">Esc</kbd> Clear / exit
              </span>
            </div>
          </div>
        </>
      )}
      <Divider />
      <SectionTitle title="Key Bindings" />
      <div className="px-4 py-2">
        <KeyboardShortcutsSettings />
      </div>
    </div>
  );

  const renderMarketplace = () => (
    <div className="space-y-1">
      <SectionTitle title="Connection" description="Configure the marketplace server endpoint" />
      <div className="rounded-lg px-4 py-3 transition-colors hover:bg-xp-surface-light/50">
        <div className="flex items-center gap-3 mb-2">
          <Globe size={18} className="shrink-0 text-xp-text-secondary" />
          <div>
            <div className="text-sm font-medium text-xp-text">Marketplace API URL</div>
            <div className="text-xs text-xp-text-secondary mt-0.5">
              Base URL for the extension marketplace server
            </div>
          </div>
        </div>
        <div className="ml-[30px]">
          <input
            type="text"
            value={marketplaceUrl}
            onChange={(e) => setMarketplaceUrl(e.target.value)}
            placeholder="http://localhost:3000/api"
            className="w-full h-9 rounded-md border border-xp-border bg-xp-bg px-3 text-sm text-xp-text transition-colors hover:border-xp-text-secondary focus:border-xp-accent focus:outline-none focus:ring-1 focus:ring-xp-accent font-mono"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-xp-text-secondary/60">
              Default: {defaultMarketplaceUrl}
            </span>
            {marketplaceUrl !== defaultMarketplaceUrl && (
              <button
                onClick={() => setMarketplaceUrl(defaultMarketplaceUrl)}
                className="flex items-center gap-1 text-xs text-xp-text-secondary hover:text-xp-text transition-colors"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderBackup = () => <BackupRestoreSettings />;

  const renderAudit = () => <AuditLogSettings />;

  const renderVersioning = () => <VersioningSettings />;

  const tabContent: Record<SettingsTab, () => React.ReactNode> = {
    general: renderGeneral,
    explorer: renderExplorer,
    'context-menu': renderContextMenu,
    ai: renderAI,
    permissions: renderPermissions,
    indexing: renderIndexing,
    shortcuts: renderShortcuts,
    marketplace: renderMarketplace,
    accessibility: renderAccessibility,
    backup: renderBackup,
    audit: renderAudit,
    versioning: renderVersioning,
  };

  return (
    <div className="min-h-screen bg-xp-bg text-xp-text flex flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-xp-border/50 bg-xp-bg/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-6 py-4">
          <button
            onClick={() => setLocation('/')}
            className="flex items-center justify-center h-8 w-8 rounded-md text-xp-text-secondary transition-colors hover:bg-xp-surface hover:text-xp-text"
            title="Back to Home"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-xp-text leading-tight">Settings</h1>
            <p className="text-xs text-xp-text-secondary">Customize your Xplorer experience</p>
          </div>
        </div>
      </div>

      {/* ── Body: Sidebar + Content ─────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto flex h-full">
          {/* Sidebar */}
          <nav className="shrink-0 w-56 border-r border-xp-border/50 py-4 px-3 overflow-y-auto">
            <div className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                      isActive
                        ? 'bg-xp-accent/15 text-xp-accent'
                        : 'text-xp-text-secondary hover:bg-xp-surface hover:text-xp-text'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-xp-accent' : ''} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-medium truncate ${isActive ? 'text-xp-accent' : ''}`}
                      >
                        {tab.label}
                      </div>
                      <div className="text-[10px] text-xp-text-secondary/60 truncate">
                        {tab.description}
                      </div>
                    </div>
                    {isActive && <ChevronRight size={14} className="shrink-0 text-xp-accent/60" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1 overflow-y-auto py-4 px-2">
            <div className="max-w-2xl">
              {/* Tab heading */}
              <div className="px-4 mb-4">
                <h2 className="text-xl font-semibold text-xp-text">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h2>
                <p className="text-sm text-xp-text-secondary mt-0.5">
                  {tabs.find((t) => t.id === activeTab)?.description}
                </p>
              </div>

              {/* Settings content */}
              {tabContent[activeTab]()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
