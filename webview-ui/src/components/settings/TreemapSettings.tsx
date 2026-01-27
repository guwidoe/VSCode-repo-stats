/**
 * Treemap Settings - Configuration for the Treemap view.
 */

import type { ExtensionSettings, TooltipSettings } from '../../types';
import { SelectSetting } from './SelectSetting';
import { CheckboxGroupSetting } from './CheckboxGroupSetting';

interface Props {
  settings: ExtensionSettings;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
}

const TOOLTIP_OPTIONS: { key: keyof TooltipSettings; label: string }[] = [
  { key: 'showLinesOfCode', label: 'Lines of Code' },
  { key: 'showFileSize', label: 'File Size' },
  { key: 'showLanguage', label: 'Language' },
  { key: 'showLastModified', label: 'Last Modified' },
  { key: 'showComplexity', label: 'Complexity' },
  { key: 'showCommentLines', label: 'Comment Lines' },
  { key: 'showCommentRatio', label: 'Comment Ratio' },
  { key: 'showBlankLines', label: 'Blank Lines' },
  { key: 'showCodeDensity', label: 'Code Density' },
  { key: 'showFileCount', label: 'File Count' },
];

export function TreemapSettings({ settings, updateSettings }: Props) {
  const handleTooltipChange = (key: string, checked: boolean) => {
    const newTooltipSettings = {
      ...settings.tooltipSettings,
      [key]: checked,
    };
    updateSettings({ tooltipSettings: newTooltipSettings });
  };

  const tooltipOptions = TOOLTIP_OPTIONS.map((opt) => ({
    key: opt.key,
    label: opt.label,
    checked: settings.tooltipSettings?.[opt.key] ?? false,
  }));

  return (
    <div className="settings-sections">
      <SelectSetting
        title="Default Color Mode"
        description="How to color files in the treemap view"
        value={settings.defaultColorMode}
        options={[
          { value: 'language', label: 'By Language' },
          { value: 'age', label: 'By File Age' },
          { value: 'complexity', label: 'By Complexity' },
          { value: 'density', label: 'By Code Density' },
        ]}
        onChange={(value) =>
          updateSettings({
            defaultColorMode: value as 'language' | 'age' | 'complexity' | 'density',
          })
        }
      />

      <CheckboxGroupSetting
        title="Tooltip Contents"
        description="Choose which metrics to display in the treemap tooltip when hovering over files"
        options={tooltipOptions}
        onChange={handleTooltipChange}
      />
    </div>
  );
}
