/**
 * General Settings - Analysis and file patterns configuration.
 */

import { useMemo, useState } from 'react';
import type {
  AnalysisResult,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
  SettingWriteTarget,
} from '../../types';
import { PatternListSetting } from './PatternListSetting';
import { NumberSetting } from './NumberSetting';
import { ScopedSettingHeader } from './ScopedSettingHeader';
import { getScopedSettingDisplayValue } from '../../utils/scopedSettings';

interface Props {
  scopedSettings: RepoScopedSettings;
  data: AnalysisResult | null;
  repoScopeAvailable: boolean;
  updateScopedSetting: <K extends RepoScopableSettingKey>(
    key: K,
    value: RepoScopableSettingValueMap[K],
    target: SettingWriteTarget
  ) => void;
  resetScopedSetting: (key: RepoScopableSettingKey) => void;
  requestRefresh: () => void;
}

function getInitialTargets(scopedSettings: RepoScopedSettings): Record<RepoScopableSettingKey, SettingWriteTarget> {
  return {
    excludePatterns: scopedSettings.excludePatterns.source === 'repo' ? 'repo' : 'global',
    generatedPatterns: scopedSettings.generatedPatterns.source === 'repo' ? 'repo' : 'global',
    binaryExtensions: scopedSettings.binaryExtensions.source === 'repo' ? 'repo' : 'global',
    locExcludedExtensions: scopedSettings.locExcludedExtensions.source === 'repo' ? 'repo' : 'global',
    maxCommitsToAnalyze: scopedSettings.maxCommitsToAnalyze.source === 'repo' ? 'repo' : 'global',
    'evolution.samplingMode': scopedSettings['evolution.samplingMode'].source === 'repo' ? 'repo' : 'global',
    'evolution.snapshotIntervalDays': scopedSettings['evolution.snapshotIntervalDays'].source === 'repo' ? 'repo' : 'global',
    'evolution.showInactivePeriods': scopedSettings['evolution.showInactivePeriods'].source === 'repo' ? 'repo' : 'global',
    'evolution.maxSnapshots': scopedSettings['evolution.maxSnapshots'].source === 'repo' ? 'repo' : 'global',
    'evolution.maxSeries': scopedSettings['evolution.maxSeries'].source === 'repo' ? 'repo' : 'global',
    'evolution.cohortFormat': scopedSettings['evolution.cohortFormat'].source === 'repo' ? 'repo' : 'global',
  };
}

export function GeneralSettings({
  scopedSettings,
  data,
  repoScopeAvailable,
  updateScopedSetting,
  resetScopedSetting,
  requestRefresh,
}: Props) {
  const [targets, setTargets] = useState<Record<RepoScopableSettingKey, SettingWriteTarget>>(
    () => getInitialTargets(scopedSettings)
  );

  const resolvedTargets = useMemo(
    () => ({ ...getInitialTargets(scopedSettings), ...targets }),
    [scopedSettings, targets]
  );

  const setTarget = (key: RepoScopableSettingKey, target: SettingWriteTarget) => {
    setTargets((current) => ({
      ...current,
      [key]: target === 'repo' && !repoScopeAvailable ? 'global' : target,
    }));
  };

  const renderScopedHeader = (key: RepoScopableSettingKey) => (
    <ScopedSettingHeader
      target={resolvedTargets[key]}
      source={scopedSettings[key].source}
      hasRepoOverride={scopedSettings[key].repoValue !== undefined}
      repoScopeAvailable={repoScopeAvailable}
      onTargetChange={(target) => setTarget(key, target)}
      onResetRepoOverride={() => resetScopedSetting(key)}
    />
  );
  return (
    <>
      {/* SCC Info Section */}
      {data?.sccInfo && (
        <div className="settings-info-section">
          <h3>Line Counter (scc)</h3>
          <div className="scc-info">
            <div className="scc-info-item">
              <span className="scc-info-label">Version:</span>
              <span className="scc-info-value">{data.sccInfo.version}</span>
            </div>
            <div className="scc-info-item">
              <span className="scc-info-label">Source:</span>
              <span className="scc-info-value">
                {data.sccInfo.source === 'system'
                  ? 'System installed'
                  : 'Auto-downloaded'}
              </span>
            </div>
          </div>
          <p className="scc-info-note">
            <strong>Note:</strong> Files listed in your{' '}
            <code>.gitignore</code> are automatically excluded from analysis.
          </p>
        </div>
      )}

      <div className="settings-sections">
        <PatternListSetting
          title="Additional Exclude Patterns"
          description="Extra file or folder exclude patterns beyond .gitignore (e.g. vendor, backend/fixtures, /src, /README.md, **/fixtures/**)"
          patterns={getScopedSettingDisplayValue(scopedSettings, 'excludePatterns', resolvedTargets.excludePatterns)}
          onChange={(patterns) => updateScopedSetting('excludePatterns', patterns, resolvedTargets.excludePatterns)}
          placeholder="e.g., vendor, backend/fixtures, /src, /README.md"
          headerContent={renderScopedHeader('excludePatterns')}
        />

        <PatternListSetting
          title="Generated File Patterns"
          description="Patterns to identify generated files (flagged in file metadata and overview stats)"
          patterns={getScopedSettingDisplayValue(scopedSettings, 'generatedPatterns', resolvedTargets.generatedPatterns)}
          onChange={(patterns) => updateScopedSetting('generatedPatterns', patterns, resolvedTargets.generatedPatterns)}
          placeholder="e.g., **/dist/**, *.min.js"
          headerContent={renderScopedHeader('generatedPatterns')}
        />

        <PatternListSetting
          title="Binary File Extensions"
          description="File extensions considered binary for classification and binary-focused views."
          patterns={getScopedSettingDisplayValue(scopedSettings, 'binaryExtensions', resolvedTargets.binaryExtensions)}
          onChange={(patterns) => updateScopedSetting('binaryExtensions', patterns, resolvedTargets.binaryExtensions)}
          placeholder="e.g., .png, .woff2"
          headerContent={renderScopedHeader('binaryExtensions')}
        />

        <PatternListSetting
          title="LOC Excluded Extensions"
          description="File extensions excluded from LOC counting (use this for files like .svg that should not inflate code totals)."
          patterns={getScopedSettingDisplayValue(scopedSettings, 'locExcludedExtensions', resolvedTargets.locExcludedExtensions)}
          onChange={(patterns) =>
            updateScopedSetting('locExcludedExtensions', patterns, resolvedTargets.locExcludedExtensions)
          }
          placeholder="e.g., .svg, svg, **/*.svg"
          headerContent={renderScopedHeader('locExcludedExtensions')}
        />

        <NumberSetting
          title="Max Commits to Analyze"
          description="Performance limit for large repositories. Higher values give more complete data but take longer."
          value={getScopedSettingDisplayValue(scopedSettings, 'maxCommitsToAnalyze', resolvedTargets.maxCommitsToAnalyze)}
          onChange={(value) =>
            updateScopedSetting('maxCommitsToAnalyze', value, resolvedTargets.maxCommitsToAnalyze)
          }
          min={100}
          max={100000}
          step={1000}
          headerContent={renderScopedHeader('maxCommitsToAnalyze')}
        />
      </div>

      <div className="settings-footer">
        <button className="refresh-after-settings" onClick={requestRefresh}>
          Re-analyze Repository
        </button>
        <p className="settings-hint">
          Click to re-analyze after changing exclude patterns, generated patterns, binary extensions, or LOC extension filters.
        </p>
      </div>
    </>
  );
}
