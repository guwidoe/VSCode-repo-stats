/**
 * Settings Panel - UI for editing extension settings with tabbed interface.
 */

import { useState } from 'react';
import { useStore } from '../../store';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { SettingsTabs, type SettingsTab } from './SettingsTabs';
import { GeneralSettings } from './GeneralSettings';
import { OverviewSettings } from './OverviewSettings';
import { ChartsSettings } from './ChartsSettings';
import { EvolutionSettings } from './EvolutionSettings';
import { TreemapSettings } from './TreemapSettings';
import './SettingsPanel.css';

export function SettingsPanel() {
  const settings = useStore((state) => state.settings);
  const scopedSettings = useStore((state) => state.scopedSettings);
  const repoScopeAvailable = useStore((state) => state.repoScopeAvailable);
  const data = useStore((state) => state.data);
  const { updateSettings, updateScopedSetting, resetScopedSetting, requestRefresh } = useVsCodeApi();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  if (!settings || !scopedSettings) {
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
          Configure how Repo Stats analyzes your selected target. Changes are saved
          automatically. Analysis settings with a scope switch can be stored
          globally or in <code>.vscode/settings.json</code> when repo scope is available.
        </p>
      </div>

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="settings-content">
        {activeTab === 'general' && (
          <GeneralSettings
            scopedSettings={scopedSettings}
            data={data}
            repoScopeAvailable={repoScopeAvailable}
            updateScopedSetting={updateScopedSetting}
            resetScopedSetting={resetScopedSetting}
            requestRefresh={requestRefresh}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewSettings settings={settings} updateSettings={updateSettings} />
        )}

        {activeTab === 'charts' && (
          <ChartsSettings settings={settings} updateSettings={updateSettings} />
        )}

        {activeTab === 'evolution' && (
          <EvolutionSettings
            settings={settings}
            scopedSettings={scopedSettings}
            repoScopeAvailable={repoScopeAvailable}
            updateSettings={updateSettings}
            updateScopedSetting={updateScopedSetting}
            resetScopedSetting={resetScopedSetting}
          />
        )}

        {activeTab === 'treemap' && (
          <TreemapSettings settings={settings} data={data} updateSettings={updateSettings} />
        )}
      </div>
    </div>
  );
}
