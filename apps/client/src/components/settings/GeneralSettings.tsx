import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import {
  Palette,
  Globe,
  Type,
  Sparkles,
  PanelLeft,
  Bell,
  Save,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { startTour, resetTourCompleted } from '@/hooks/use-tour';
import { resetBetaWarning } from '@/components/dialogs/BetaWarningDialog';
import { applyFontSize } from '@/lib/utils';
import { useAllThemes } from '@/lib/theme-registry';
import {
  Toggle,
  SelectField,
  SettingRow,
  SectionTitle,
  Divider,
  SystemIntegrationSettings,
  type AppSettings,
  DEFAULT_SETTINGS,
} from './shared';

interface GeneralSettingsProps {
  settings: AppSettings;
  updateSetting: (key: string, value: string | boolean | number) => void;
  setSettings: (s: AppSettings) => void;
}

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'id', label: 'Bahasa Indonesia' },
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

const GeneralSettings = ({ settings, updateSetting, setSettings }: GeneralSettingsProps) => {
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const allThemes = useAllThemes();

  const themes = Object.entries(allThemes).map(([key, th]) => ({
    value: key,
    label: th.name,
  }));

  return (
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
      <SettingRow
        icon={Globe}
        label={t('settings.general.language')}
        description={t('settings.general.languageDesc')}
      >
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
          className="bg-xp-blue flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
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
          className="flex items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Show Warning
        </button>
      </SettingRow>

      <Divider />
      <div className="px-4 pt-4">
        <button
          onClick={() => setSettings(DEFAULT_SETTINGS)}
          className="text-xp-red hover:bg-xp-red/10 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
        >
          <RotateCcw size={14} />
          Reset all settings to defaults
        </button>
      </div>
    </div>
  );
};

export default GeneralSettings;
