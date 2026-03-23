import { LayoutGrid, Eye, FileText, FolderOpen } from 'lucide-react';
import { Toggle, SelectField, SettingRow, SectionTitle, Divider, type AppSettings } from './shared';

interface ExplorerSettingsProps {
  settings: AppSettings;
  updateSetting: (key: string, value: string | boolean | number) => void;
}

const viewModes = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
  { value: 'details', label: 'Details' },
];

const ExplorerSettings = ({ settings, updateSetting }: ExplorerSettingsProps) => (
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

export default ExplorerSettings;
