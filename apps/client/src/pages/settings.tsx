import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  FolderOpen,
  Bot,
  Search,
  Accessibility,
  Shield,
  Keyboard,
  Store,
  HardDrive,
  ClipboardList,
  History,
  MousePointerClick,
  Settings2,
  ChevronRight,
  Globe,
} from 'lucide-react';
import {
  AgentService,
  type SafeAgentSettings,
  type UpdateAgentSettingsPayload,
  type AgentPermissions,
} from '@/lib/agent-service';
import TokenizerSettings from '@/components/TokenizerSettings';
import BackupRestoreSettings from '@/components/settings/BackupRestoreSettings';
import AuditLogSettings from '@/components/settings/AuditLogSettings';
import VersioningSettings from '@/components/settings/VersioningSettings';
import ContextMenuRulesCard from '@/components/settings/ContextMenuRulesCard';
import ShortcutsSettingsPanel from '@/components/settings/ShortcutsSettings';
import GeneralSettings from '@/components/settings/GeneralSettings';
import ExplorerSettings from '@/components/settings/ExplorerSettings';
import AISettings from '@/components/settings/AISettings';
import PermissionsSettings from '@/components/settings/PermissionsSettings';
import AccessibilitySettings from '@/components/settings/AccessibilitySettings';
import { loadFontSize } from '@/lib/utils';
import { AppSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from '@/components/settings/shared';

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

const MARKETPLACE_KEY = STORAGE_KEYS.MARKETPLACE_URL;
const DEFAULT_MARKETPLACE_URL = 'https://xplorer.space/api';

const MarketplaceSettings = ({
  marketplaceUrl,
  setMarketplaceUrl,
}: {
  marketplaceUrl: string;
  setMarketplaceUrl: (v: string) => void;
}) => (
  <div className="space-y-1">
    <div className="mb-1 px-4 pb-1 pt-2">
      <h3 className="text-xp-text-secondary text-xs font-semibold uppercase tracking-wider">
        Connection
      </h3>
      <p className="text-xp-text-secondary/70 mt-0.5 text-xs">
        Configure the marketplace server endpoint
      </p>
    </div>
    <div className="hover:bg-xp-surface-light/50 rounded-lg px-4 py-3 transition-colors">
      <div className="mb-2 flex items-center gap-3">
        <Globe size={18} className="text-xp-text-secondary shrink-0" />
        <div>
          <div className="text-xp-text text-sm font-medium">Marketplace API URL</div>
          <div className="text-xp-text-secondary mt-0.5 text-xs">
            Base URL for the extension marketplace server
          </div>
        </div>
      </div>
      <div className="ml-[30px]">
        <input
          type="text"
          value={marketplaceUrl}
          onChange={(e) => setMarketplaceUrl(e.target.value)}
          placeholder="https://xplorer.space/api"
          className="border-xp-border bg-xp-bg text-xp-text hover:border-xp-text-secondary focus:border-xp-accent focus:ring-xp-accent h-9 w-full rounded-md border px-3 font-mono text-sm transition-colors focus:outline-none focus:ring-1"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xp-text-secondary/60 text-[10px]">
            Default: {DEFAULT_MARKETPLACE_URL}
          </span>
          {marketplaceUrl !== DEFAULT_MARKETPLACE_URL && (
            <button
              onClick={() => setMarketplaceUrl(DEFAULT_MARKETPLACE_URL)}
              className="text-xp-text-secondary hover:text-xp-text flex items-center gap-1 text-xs transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default function Settings() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      /* ignore localStorage/parse errors */
    }
    return DEFAULT_SETTINGS;
  });

  const [marketplaceUrl, setMarketplaceUrl] = useState(() => {
    try {
      return localStorage.getItem(MARKETPLACE_KEY) || DEFAULT_MARKETPLACE_URL;
    } catch {
      return DEFAULT_MARKETPLACE_URL;
    }
  });

  useEffect(() => {
    localStorage.setItem(MARKETPLACE_KEY, marketplaceUrl);
  }, [marketplaceUrl]);

  const [agentSettings, setAgentSettings] = useState<SafeAgentSettings>({
    enabled: true,
    has_api_key: false,
    has_openai_api_key: false,
    model: 'claude-sonnet-4-6',
    max_turns: 25,
    auto_approve: false,
    thinking_enabled: false,
    thinking_budget: 10000,
  });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
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

  // Persist non-secret agent settings on change (debounced)
  useEffect(() => {
    if (!agentSettingsLoaded) return;
    const payload: UpdateAgentSettingsPayload = {
      enabled: agentSettings.enabled,
      model: agentSettings.model,
      max_turns: agentSettings.max_turns,
      auto_approve: agentSettings.auto_approve,
      thinking_enabled: agentSettings.thinking_enabled,
      thinking_budget: agentSettings.thinking_budget,
    };
    const timer = setTimeout(() => {
      AgentService.updateSettings(payload).catch(console.error);
    }, 500);
    return () => clearTimeout(timer);
  }, [agentSettings, agentSettingsLoaded]);

  // Persist API keys on change (debounced, separate command)
  useEffect(() => {
    if (!agentSettingsLoaded) return;
    if (apiKeyInput === '' && openaiKeyInput === '') return;
    const timer = setTimeout(() => {
      const payload: { api_key?: string; openai_api_key?: string } = {};
      if (apiKeyInput !== '') payload.api_key = apiKeyInput;
      if (openaiKeyInput !== '') payload.openai_api_key = openaiKeyInput;
      AgentService.updateApiKeys(payload)
        .then(() => {
          setAgentSettings((prev) => ({
            ...prev,
            has_api_key: apiKeyInput !== '' ? true : prev.has_api_key,
            has_openai_api_key: openaiKeyInput !== '' ? true : prev.has_openai_api_key,
          }));
        })
        .catch(console.error);
    }, 500);
    return () => clearTimeout(timer);
  }, [apiKeyInput, openaiKeyInput, agentSettingsLoaded]);

  const updateAgentSetting = <K extends keyof SafeAgentSettings>(
    key: K,
    value: SafeAgentSettings[K],
  ) => {
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
    if (settings.highContrast) document.documentElement.classList.add('high-contrast');
    // Mount-only: apply persisted accessibility settings on init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSetting = (key: string, value: string | boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralSettings
            settings={settings}
            updateSetting={updateSetting}
            setSettings={setSettings}
          />
        );
      case 'explorer':
        return <ExplorerSettings settings={settings} updateSetting={updateSetting} />;
      case 'context-menu':
        return <ContextMenuRulesCard />;
      case 'ai':
        return (
          <AISettings
            agentSettings={agentSettings}
            updateAgentSetting={updateAgentSetting}
            setAgentSettings={setAgentSettings}
            apiKeyInput={apiKeyInput}
            setApiKeyInput={setApiKeyInput}
            openaiKeyInput={openaiKeyInput}
            setOpenaiKeyInput={setOpenaiKeyInput}
          />
        );
      case 'permissions':
        return (
          <PermissionsSettings
            permissions={permissions}
            setPermissions={setPermissions}
            agentSettings={agentSettings}
          />
        );
      case 'indexing':
        return (
          <div className="px-4 py-2">
            <TokenizerSettings />
          </div>
        );
      case 'shortcuts':
        return <ShortcutsSettingsPanel />;
      case 'marketplace':
        return (
          <MarketplaceSettings
            marketplaceUrl={marketplaceUrl}
            setMarketplaceUrl={setMarketplaceUrl}
          />
        );
      case 'accessibility':
        return <AccessibilitySettings settings={settings} updateSetting={updateSetting} />;
      case 'backup':
        return <BackupRestoreSettings />;
      case 'audit':
        return <AuditLogSettings />;
      case 'versioning':
        return <VersioningSettings />;
    }
  };

  return (
    <div className="bg-xp-bg text-xp-text flex min-h-screen flex-col">
      {/* Header */}
      <div className="border-xp-border/50 bg-xp-bg/80 shrink-0 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <button
            onClick={() => setLocation('/')}
            className="text-xp-text-secondary hover:bg-xp-surface hover:text-xp-text flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            title="Back to Home"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xp-text text-lg font-semibold leading-tight">Settings</h1>
            <p className="text-xp-text-secondary text-xs">Customize your Xplorer experience</p>
          </div>
        </div>
      </div>

      {/* Body: Sidebar + Content */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-6xl">
          {/* Sidebar */}
          <nav className="border-xp-border/50 w-56 shrink-0 overflow-y-auto border-r px-3 py-4">
            <div className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                      isActive
                        ? 'bg-xp-accent/15 text-xp-accent'
                        : 'text-xp-text-secondary hover:bg-xp-surface hover:text-xp-text'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-xp-accent' : ''} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-sm font-medium ${isActive ? 'text-xp-accent' : ''}`}
                      >
                        {tab.label}
                      </div>
                      <div className="text-xp-text-secondary/60 truncate text-[10px]">
                        {tab.description}
                      </div>
                    </div>
                    {isActive && <ChevronRight size={14} className="text-xp-accent/60 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1 overflow-y-auto px-2 py-4">
            <div className="max-w-2xl">
              {/* Tab heading */}
              <div className="mb-4 px-4">
                <h2 className="text-xp-text text-xl font-semibold">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h2>
                <p className="text-xp-text-secondary mt-0.5 text-sm">
                  {tabs.find((t) => t.id === activeTab)?.description}
                </p>
              </div>

              {/* Settings content */}
              {renderTabContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
