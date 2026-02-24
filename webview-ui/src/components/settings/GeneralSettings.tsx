/**
 * General Settings - Analysis and file patterns configuration.
 */

import type { ExtensionSettings, AnalysisResult } from '../../types';
import { PatternListSetting } from './PatternListSetting';
import { NumberSetting } from './NumberSetting';

interface Props {
  settings: ExtensionSettings;
  data: AnalysisResult | null;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
  requestRefresh: () => void;
}

export function GeneralSettings({ settings, data, updateSettings, requestRefresh }: Props) {
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
          description="Extra directories to exclude beyond .gitignore (e.g., for untracked directories)"
          patterns={settings.excludePatterns}
          onChange={(patterns) => updateSettings({ excludePatterns: patterns })}
          placeholder="e.g., vendor, temp"
        />

        <PatternListSetting
          title="Generated File Patterns"
          description="Patterns to identify generated files (excluded from 'Largest Files' and marked separately)"
          patterns={settings.generatedPatterns}
          onChange={(patterns) => updateSettings({ generatedPatterns: patterns })}
          placeholder="e.g., **/dist/**, *.min.js"
        />

        <PatternListSetting
          title="Binary File Extensions"
          description="File extensions considered binary for classification and binary-focused views."
          patterns={settings.binaryExtensions || []}
          onChange={(patterns) => updateSettings({ binaryExtensions: patterns })}
          placeholder="e.g., .png, .woff2"
        />

        <PatternListSetting
          title="LOC Excluded Extensions"
          description="File extensions excluded from LOC counting (use this for files like .svg that should not inflate code totals)."
          patterns={settings.locExcludedExtensions || []}
          onChange={(patterns) => updateSettings({ locExcludedExtensions: patterns })}
          placeholder="e.g., .svg, svg, **/*.svg"
        />

        <NumberSetting
          title="Max Commits to Analyze"
          description="Performance limit for large repositories. Higher values give more complete data but take longer."
          value={settings.maxCommitsToAnalyze}
          onChange={(value) => updateSettings({ maxCommitsToAnalyze: value })}
          min={100}
          max={100000}
          step={1000}
        />
      </div>

      <div className="settings-footer">
        <button className="refresh-after-settings" onClick={requestRefresh}>
          Re-analyze Repository
        </button>
        <p className="settings-hint">
          Click to re-analyze after changing exclude, generated, binary, or LOC-excluded extension patterns.
        </p>
      </div>
    </>
  );
}
