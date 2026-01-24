/**
 * Settings Panel - UI for editing extension settings with tabbed interface.
 */

import { useState } from 'react';
import { useStore } from '../../store';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { SettingsTabs, type SettingsTab } from './SettingsTabs';
import { GeneralSettings } from './GeneralSettings';
import { ChartsSettings } from './ChartsSettings';
import { TreemapSettings } from './TreemapSettings';
import './SettingsPanel.css';

export function SettingsPanel() {
  const settings = useStore((state) => state.settings);
  const data = useStore((state) => state.data);
  const { updateSettings, requestRefresh } = useVsCodeApi();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

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

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="settings-content">
        {activeTab === 'general' && (
          <GeneralSettings
            settings={settings}
            data={data}
            updateSettings={updateSettings}
            requestRefresh={requestRefresh}
          />
        )}

        {activeTab === 'charts' && (
          <ChartsSettings settings={settings} updateSettings={updateSettings} />
        )}

        {activeTab === 'treemap' && (
          <TreemapSettings settings={settings} updateSettings={updateSettings} />
        )}
      </div>
    </div>
  );
}
