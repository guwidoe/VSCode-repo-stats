/**
 * Evolution Settings - Configuration for on-demand evolution analysis.
 */

import { useMemo, useState } from 'react';
import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
  SettingWriteTarget,
} from '../../types';
import { SelectSetting } from './SelectSetting';
import { NumberSetting } from './NumberSetting';
import { ScopedSettingHeader } from './ScopedSettingHeader';
import { getScopedSettingDisplayValue } from '../../utils/scopedSettings';

interface Props {
  settings: ExtensionSettings;
  scopedSettings: RepoScopedSettings;
  repoScopeAvailable: boolean;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
  updateScopedSetting: <K extends RepoScopableSettingKey>(
    key: K,
    value: RepoScopableSettingValueMap[K],
    target: SettingWriteTarget
  ) => void;
  resetScopedSetting: (key: RepoScopableSettingKey) => void;
}

const TIME_GRANULARITY_OPTIONS = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'biweekly', label: 'Biweekly', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 },
  { value: 'quarterly', label: 'Quarterly', days: 90 },
  { value: 'yearly', label: 'Yearly', days: 365 },
] as const;

type EvolutionScopedKey =
  | 'evolution.samplingMode'
  | 'evolution.snapshotIntervalDays'
  | 'evolution.snapshotIntervalCommits'
  | 'evolution.showInactivePeriods'
  | 'evolution.maxSnapshots'
  | 'evolution.maxSeries'
  | 'evolution.cohortFormat';

function getTimeGranularity(snapshotIntervalDays: number): string {
  return TIME_GRANULARITY_OPTIONS.find((option) => option.days === snapshotIntervalDays)?.value ?? 'custom';
}

function getInitialTargets(
  scopedSettings: RepoScopedSettings
): Record<EvolutionScopedKey, SettingWriteTarget> {
  return {
    'evolution.samplingMode':
      scopedSettings['evolution.samplingMode'].source === 'repo' ? 'repo' : 'global',
    'evolution.snapshotIntervalDays':
      scopedSettings['evolution.snapshotIntervalDays'].source === 'repo' ? 'repo' : 'global',
    'evolution.snapshotIntervalCommits':
      scopedSettings['evolution.snapshotIntervalCommits'].source === 'repo' ? 'repo' : 'global',
    'evolution.showInactivePeriods':
      scopedSettings['evolution.showInactivePeriods'].source === 'repo' ? 'repo' : 'global',
    'evolution.maxSnapshots':
      scopedSettings['evolution.maxSnapshots'].source === 'repo' ? 'repo' : 'global',
    'evolution.maxSeries':
      scopedSettings['evolution.maxSeries'].source === 'repo' ? 'repo' : 'global',
    'evolution.cohortFormat':
      scopedSettings['evolution.cohortFormat'].source === 'repo' ? 'repo' : 'global',
  };
}

export function EvolutionSettings({
  settings,
  scopedSettings,
  repoScopeAvailable,
  updateSettings,
  updateScopedSetting,
  resetScopedSetting,
}: Props) {
  const [preferCustomTimeInterval, setPreferCustomTimeInterval] = useState(false);
  const [targets, setTargets] = useState<Record<EvolutionScopedKey, SettingWriteTarget>>(
    () => getInitialTargets(scopedSettings)
  );

  const resolvedTargets = useMemo(
    () => ({ ...getInitialTargets(scopedSettings), ...targets }),
    [scopedSettings, targets]
  );

  const samplingMode = getScopedSettingDisplayValue(
    scopedSettings,
    'evolution.samplingMode',
    resolvedTargets['evolution.samplingMode']
  );
  const snapshotIntervalDays = getScopedSettingDisplayValue(
    scopedSettings,
    'evolution.snapshotIntervalDays',
    resolvedTargets['evolution.snapshotIntervalDays']
  );
  const snapshotIntervalCommits = getScopedSettingDisplayValue(
    scopedSettings,
    'evolution.snapshotIntervalCommits',
    resolvedTargets['evolution.snapshotIntervalCommits']
  );
  const showInactivePeriods = getScopedSettingDisplayValue(
    scopedSettings,
    'evolution.showInactivePeriods',
    resolvedTargets['evolution.showInactivePeriods']
  );
  const maxSnapshots = getScopedSettingDisplayValue(
    scopedSettings,
    'evolution.maxSnapshots',
    resolvedTargets['evolution.maxSnapshots']
  );
  const maxSeries = getScopedSettingDisplayValue(
    scopedSettings,
    'evolution.maxSeries',
    resolvedTargets['evolution.maxSeries']
  );
  const cohortFormat = getScopedSettingDisplayValue(
    scopedSettings,
    'evolution.cohortFormat',
    resolvedTargets['evolution.cohortFormat']
  );

  const derivedTimeGranularity = getTimeGranularity(snapshotIntervalDays);
  const timeGranularity =
    preferCustomTimeInterval || derivedTimeGranularity === 'custom'
      ? 'custom'
      : derivedTimeGranularity;

  const setTarget = (key: EvolutionScopedKey, target: SettingWriteTarget) => {
    setTargets((current) => ({
      ...current,
      [key]: target === 'repo' && !repoScopeAvailable ? 'global' : target,
    }));
  };

  const renderScopedHeader = (key: EvolutionScopedKey) => (
    <ScopedSettingHeader
      target={resolvedTargets[key]}
      source={scopedSettings[key].source}
      hasRepoOverride={scopedSettings[key].repoValue !== undefined}
      repoScopeAvailable={repoScopeAvailable}
      compact
      onTargetChange={(target) => setTarget(key, target)}
      onResetRepoOverride={() => resetScopedSetting(key)}
    />
  );

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
        title="Sampling Mode"
        description="Choose whether Evolution samples history by elapsed time, by commit interval, or auto-distributes snapshots across the repository history."
        value={samplingMode}
        options={[
          { value: 'time', label: 'Time' },
          { value: 'commit', label: 'Commit' },
          { value: 'auto', label: 'Auto' },
        ]}
        onChange={(value) =>
          updateScopedSetting(
            'evolution.samplingMode',
            value,
            resolvedTargets['evolution.samplingMode']
          )
        }
        headerContent={renderScopedHeader('evolution.samplingMode')}
      />

      {samplingMode === 'time' && (
        <>
          <SelectSetting
            title="Time Snapshot Granularity"
            description="How densely Evolution samples repository history in time-based mode. Finer granularity gives more detail, but analysis takes longer."
            value={timeGranularity}
            options={[
              ...TIME_GRANULARITY_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={(value) => {
              if (value === 'custom') {
                setPreferCustomTimeInterval(true);
                return;
              }

              const selected = TIME_GRANULARITY_OPTIONS.find((option) => option.value === value);
              if (!selected) {
                return;
              }

              setPreferCustomTimeInterval(false);
              updateScopedSetting(
                'evolution.snapshotIntervalDays',
                selected.days,
                resolvedTargets['evolution.snapshotIntervalDays']
              );
            }}
            headerContent={renderScopedHeader('evolution.snapshotIntervalDays')}
          />

          {timeGranularity === 'custom' && (
            <NumberSetting
              title="Custom Snapshot Interval (Days)"
              description="Exact minimum time between analyzed snapshots in time-based mode."
              value={snapshotIntervalDays}
              onChange={(value) =>
                updateScopedSetting(
                  'evolution.snapshotIntervalDays',
                  value,
                  resolvedTargets['evolution.snapshotIntervalDays']
                )
              }
              min={1}
              max={365}
              step={1}
            />
          )}
        </>
      )}

      {samplingMode === 'commit' && (
        <NumberSetting
          title="Commit Snapshot Interval"
          description="Analyze every Nth commit when Evolution sampling mode is commit-based."
          value={snapshotIntervalCommits}
          onChange={(value) =>
            updateScopedSetting(
              'evolution.snapshotIntervalCommits',
              value,
              resolvedTargets['evolution.snapshotIntervalCommits']
            )
          }
          min={1}
          max={10000}
          step={1}
          headerContent={renderScopedHeader('evolution.snapshotIntervalCommits')}
        />
      )}

      {samplingMode === 'auto' && (
        <div className="setting-section">
          <div className="setting-header">
            <div className="setting-header-main">
              <h3 className="setting-title">Auto Snapshot Distribution</h3>
              <p className="setting-description">
                Auto mode distributes snapshots across the full repository history using the Maximum Snapshots setting as its target density.
              </p>
            </div>
          </div>
        </div>
      )}

      <SelectSetting
        title="Inactive Periods"
        description="Control whether Evolution charts fill inactive periods between snapshots or only show directly sampled points."
        value={showInactivePeriods ? 'show' : 'skip'}
        options={[
          { value: 'skip', label: 'Skip inactive periods' },
          { value: 'show', label: 'Show inactive periods' },
        ]}
        onChange={(value) =>
          updateScopedSetting(
            'evolution.showInactivePeriods',
            value === 'show',
            resolvedTargets['evolution.showInactivePeriods']
          )
        }
        headerContent={renderScopedHeader('evolution.showInactivePeriods')}
      />

      <NumberSetting
        title="Maximum Snapshots"
        description="Hard cap for the number of snapshots analyzed. Auto mode also uses this as its target snapshot count."
        value={maxSnapshots}
        onChange={(value) =>
          updateScopedSetting('evolution.maxSnapshots', value, resolvedTargets['evolution.maxSnapshots'])
        }
        min={2}
        max={500}
        step={1}
        headerContent={renderScopedHeader('evolution.maxSnapshots')}
      />

      <NumberSetting
        title="Default Max Series"
        description="Default series limit for Evolution charts before aggregating into 'Other'."
        value={maxSeries}
        onChange={(value) =>
          updateScopedSetting('evolution.maxSeries', value, resolvedTargets['evolution.maxSeries'])
        }
        min={5}
        max={200}
        step={1}
        headerContent={renderScopedHeader('evolution.maxSeries')}
      />

      <SelectSetting
        title="Cohort Format"
        description="How code cohorts are grouped in Evolution analysis."
        value={cohortFormat}
        options={[
          { value: '%Y', label: 'Yearly (%Y)' },
          { value: '%Y-%m', label: 'Monthly (%Y-%m)' },
          { value: '%Y-W%W', label: 'Weekly (%Y-W%W)' },
        ]}
        onChange={(value) =>
          updateScopedSetting(
            'evolution.cohortFormat',
            value,
            resolvedTargets['evolution.cohortFormat']
          )
        }
        headerContent={renderScopedHeader('evolution.cohortFormat')}
      />
    </div>
  );
}
