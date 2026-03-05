/**
 * Evolution Settings - Configuration for on-demand evolution analysis.
 */

import type { ExtensionSettings } from '../../types';
import { SelectSetting } from './SelectSetting';
import { NumberSetting } from './NumberSetting';

interface Props {
  settings: ExtensionSettings;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
}

export function EvolutionSettings({ settings, updateSettings }: Props) {
  return (
    <div className="settings-sections">
      <SelectSetting
        title="Auto Run Evolution"
        description="If enabled, Evolution analysis starts automatically when Evolution data is missing or stale."
        value={settings.evolution.autoRun ? 'enabled' : 'disabled'}
        options={[
          { value: 'disabled', label: 'Disabled' },
          { value: 'enabled', label: 'Enabled' },
        ]}
        onChange={(value) =>
          updateSettings({
            evolution: {
              ...settings.evolution,
              autoRun: value === 'enabled',
            },
          })
        }
      />

      <NumberSetting
        title="Snapshot Interval (Days)"
        description="Minimum time between analyzed snapshots. Higher values speed up analysis on large repositories."
        value={settings.evolution.snapshotIntervalDays}
        onChange={(value) =>
          updateSettings({
            evolution: {
              ...settings.evolution,
              snapshotIntervalDays: value,
            },
          })
        }
        min={1}
        max={365}
        step={1}
      />

      <NumberSetting
        title="Maximum Snapshots"
        description="Hard cap for the number of snapshots analyzed."
        value={settings.evolution.maxSnapshots}
        onChange={(value) =>
          updateSettings({
            evolution: {
              ...settings.evolution,
              maxSnapshots: value,
            },
          })
        }
        min={2}
        max={500}
        step={1}
      />

      <NumberSetting
        title="Default Max Series"
        description="Default series limit for Evolution charts before aggregating into 'Other'."
        value={settings.evolution.maxSeries}
        onChange={(value) =>
          updateSettings({
            evolution: {
              ...settings.evolution,
              maxSeries: value,
            },
          })
        }
        min={5}
        max={200}
        step={1}
      />

      <SelectSetting
        title="Cohort Format"
        description="How code cohorts are grouped in Evolution analysis."
        value={settings.evolution.cohortFormat}
        options={[
          { value: '%Y', label: 'Yearly (%Y)' },
          { value: '%Y-%m', label: 'Monthly (%Y-%m)' },
          { value: '%Y-W%W', label: 'Weekly (%Y-W%W)' },
        ]}
        onChange={(value) =>
          updateSettings({
            evolution: {
              ...settings.evolution,
              cohortFormat: value,
            },
          })
        }
      />
    </div>
  );
}
