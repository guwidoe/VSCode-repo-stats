/**
 * Charts Settings - Configuration for Contributors and Code Frequency charts.
 */

import type { ExtensionSettings } from '../../types';
import { SelectSetting } from './SelectSetting';
import { NumberSetting } from './NumberSetting';

interface Props {
  settings: ExtensionSettings;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
}

export function ChartsSettings({ settings, updateSettings }: Props) {
  return (
    <div className="settings-sections">
      <SelectSetting
        title="Show Empty Time Periods"
        description="Display weeks/months with no activity in charts (shows true timeline gaps)"
        value={settings.showEmptyTimePeriods ? 'show' : 'hide'}
        options={[
          { value: 'show', label: 'Show' },
          { value: 'hide', label: 'Hide' },
        ]}
        onChange={(value) =>
          updateSettings({ showEmptyTimePeriods: value === 'show' })
        }
      />

      <SelectSetting
        title="Default Time Granularity"
        description="How to group time periods in charts. 'Auto' uses weekly for small repos, monthly for larger ones."
        value={settings.defaultGranularityMode || 'auto'}
        options={[
          { value: 'auto', label: 'Auto (smart)' },
          { value: 'weekly', label: 'Always Weekly' },
          { value: 'monthly', label: 'Always Monthly' },
        ]}
        onChange={(value) =>
          updateSettings({ defaultGranularityMode: value as 'auto' | 'weekly' | 'monthly' })
        }
      />

      {(settings.defaultGranularityMode || 'auto') === 'auto' && (
        <NumberSetting
          title="Auto Granularity Threshold"
          description="In auto mode, use weekly view if repo has this many weeks or fewer. Use monthly for longer histories."
          value={settings.autoGranularityThreshold || 20}
          onChange={(value) => updateSettings({ autoGranularityThreshold: value })}
          min={1}
          max={520}
          step={1}
        />
      )}
    </div>
  );
}
