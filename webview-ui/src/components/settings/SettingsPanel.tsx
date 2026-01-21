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
          Configure how Repo Stats analyzes your repository. Changes are saved automatically.
        </p>
      </div>

      <div className="settings-sections">
        <PatternListSetting
          title="Exclude Patterns"
          description="Directories and files to exclude from analysis (glob patterns)"
          patterns={settings.excludePatterns}
          onChange={(patterns) => updateSettings({ excludePatterns: patterns })}
          placeholder="e.g., node_modules, *.log"
        />

        <PatternListSetting
          title="Generated File Patterns"
          description="Patterns to identify generated files (excluded from 'Largest Files' and marked separately)"
          patterns={settings.generatedPatterns}
          onChange={(patterns) => updateSettings({ generatedPatterns: patterns })}
          placeholder="e.g., **/dist/**, *.min.js"
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
          onChange={(value) => updateSettings({ defaultColorMode: value as 'language' | 'age' })}
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
