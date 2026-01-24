/**
 * Settings Tabs - Horizontal tab navigation for settings categories.
 */

import './SettingsTabs.css';

export type SettingsTab = 'general' | 'charts' | 'treemap';

interface Props {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const TAB_LABELS: Record<SettingsTab, string> = {
  general: 'General',
  charts: 'Charts',
  treemap: 'Treemap',
};

export function SettingsTabs({ activeTab, onTabChange }: Props) {
  const tabs: SettingsTab[] = ['general', 'charts', 'treemap'];

  return (
    <div className="settings-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
