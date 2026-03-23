import { useTranslation } from 'react-i18next';
import { Sparkles, Monitor, Eye } from 'lucide-react';
import { Toggle, SettingRow, SectionTitle, Divider, type AppSettings } from './shared';

interface AccessibilitySettingsProps {
  settings: AppSettings;
  updateSetting: (key: string, value: string | boolean | number) => void;
}

const AccessibilitySettings = ({ settings, updateSetting }: AccessibilitySettingsProps) => {
  const { t } = useTranslation();

  return (
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

      <Divider />
      <SectionTitle title={t('settings.accessibility.contrast')} />
      <SettingRow
        icon={Eye}
        label={t('settings.accessibility.highContrast')}
        description={t('settings.accessibility.highContrastDesc')}
      >
        <Toggle
          id="highContrast"
          label={t('settings.accessibility.highContrast')}
          checked={settings.highContrast}
          onChange={(v) => {
            updateSetting('highContrast', v);
            document.documentElement.classList.toggle('high-contrast', v);
          }}
        />
      </SettingRow>
    </div>
  );
};

export default AccessibilitySettings;
