/**
 * Overview Settings - Configuration for the Overview view.
 */

import type { ExtensionSettings } from '../../types';
import { SelectSetting } from './SelectSetting';

interface Props {
  settings: ExtensionSettings;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
}

export function OverviewSettings({ settings, updateSettings }: Props) {
  return (
    <div className="settings-sections">
      <SelectSetting
        title="Default Display Mode"
        description="How to display values in donut charts by default"
        value={settings.overviewDisplayMode}
        options={[
          { value: 'percent', label: 'Percentages' },
          { value: 'count', label: 'Absolute Counts' },
        ]}
        onChange={(value) =>
          updateSettings({ overviewDisplayMode: value as 'percent' | 'count' })
        }
      />
    </div>
  );
}
