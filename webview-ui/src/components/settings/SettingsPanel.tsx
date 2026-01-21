/**
 * Settings Panel - UI for editing extension settings.
 */

import { useStore } from '../../store';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { PatternListSetting } from './PatternListSetting';
import { NumberSetting } from './NumberSetting';
import { SelectSetting } from './SelectSetting';
import './SettingsPanel.css';

export function SettingsPanel() {
  const settings = useStore((state) => state.settings);
  const data = useStore((state) => state.data);
  const { updateSettings, requestRefresh } = useVsCodeApi();

  if (!settings) {
    return (
      <div className="settings-panel">
        <div className="settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Extension Settings</h2>
        <p className="settings-description">
          Configure how Repo Stats analyzes your repository. Changes are saved
          automatically.
        </p>
      </div>

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
          description="File extensions considered binary (images, fonts, compiled, etc.). These have 0 LOC but appear in Size mode."
          patterns={settings.binaryExtensions || []}
          onChange={(patterns) => updateSettings({ binaryExtensions: patterns })}
          placeholder="e.g., .png, .woff2"
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

        <SelectSetting
          title="Default Color Mode"
          description="How to color files in the treemap view"
          value={settings.defaultColorMode}
          options={[
            { value: 'language', label: 'By Language' },
            { value: 'age', label: 'By File Age' },
          ]}
          onChange={(value) =>
            updateSettings({ defaultColorMode: value as 'language' | 'age' })
          }
        />
      </div>

      <div className="settings-footer">
        <button className="refresh-after-settings" onClick={requestRefresh}>
          Re-analyze Repository
        </button>
        <p className="settings-hint">
          Click to re-analyze after changing exclude or generated patterns.
        </p>
      </div>
    </div>
  );
}
