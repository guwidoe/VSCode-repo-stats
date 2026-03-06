/**
 * Evolution Settings - Configuration for on-demand evolution analysis.
 */

import { useState } from 'react';
import type { ExtensionSettings } from '../../types';
import { SelectSetting } from './SelectSetting';
import { NumberSetting } from './NumberSetting';

interface Props {
  settings: ExtensionSettings;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
}

const SNAPSHOT_GRANULARITY_OPTIONS = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'biweekly', label: 'Biweekly', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 },
  { value: 'quarterly', label: 'Quarterly', days: 90 },
  { value: 'yearly', label: 'Yearly', days: 365 },
] as const;

function getSnapshotGranularity(snapshotIntervalDays: number): string {
  return SNAPSHOT_GRANULARITY_OPTIONS.find((option) => option.days === snapshotIntervalDays)?.value ?? 'custom';
}

export function EvolutionSettings({ settings, updateSettings }: Props) {
  const [preferCustomSnapshotInterval, setPreferCustomSnapshotInterval] = useState(false);
  const derivedSnapshotGranularity = getSnapshotGranularity(settings.evolution.snapshotIntervalDays);
  const snapshotGranularity =
    preferCustomSnapshotInterval || derivedSnapshotGranularity === 'custom'
      ? 'custom'
      : derivedSnapshotGranularity;

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

      <SelectSetting
        title="Snapshot Granularity"
        description="How densely Evolution samples repository history. Finer granularity gives more detail, but analysis takes longer."
        value={snapshotGranularity}
        options={[
          ...SNAPSHOT_GRANULARITY_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
          { value: 'custom', label: 'Custom' },
        ]}
        onChange={(value) => {
          if (value === 'custom') {
            setPreferCustomSnapshotInterval(true);
            return;
          }

          const selected = SNAPSHOT_GRANULARITY_OPTIONS.find((option) => option.value === value);
          if (!selected) {
            return;
          }

          setPreferCustomSnapshotInterval(false);
          updateSettings({
            evolution: {
              ...settings.evolution,
              snapshotIntervalDays: selected.days,
            },
          });
        }}
      />

      {snapshotGranularity === 'custom' && (
        <NumberSetting
          title="Custom Snapshot Interval (Days)"
          description="Exact minimum time between analyzed snapshots. Use this if the presets are too coarse or too fine for your repository."
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
      )}

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
