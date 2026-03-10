/**
 * Treemap Settings - Configuration for the Treemap view.
 */

import { useMemo } from 'react';
import type { AnalysisResult, ExtensionSettings, TooltipSettings, TreemapNode } from '../../types';
import { resolveAgeColorDomain } from '../../utils/colors';
import { SelectSetting } from './SelectSetting';
import { CheckboxGroupSetting } from './CheckboxGroupSetting';

interface Props {
  settings: ExtensionSettings;
  data: AnalysisResult | null;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
}

const TOOLTIP_OPTIONS: { key: keyof TooltipSettings; label: string }[] = [
  { key: 'showLinesOfCode', label: 'Lines of Code' },
  { key: 'showFileSize', label: 'File Size' },
  { key: 'showLanguage', label: 'Language' },
  { key: 'showLastModified', label: 'Last Modified' },
  { key: 'showComplexity', label: 'Complexity' },
  { key: 'showCommentLines', label: 'Comment Lines' },
  { key: 'showCommentRatio', label: 'Comment Ratio' },
  { key: 'showBlankLines', label: 'Blank Lines' },
  { key: 'showCodeDensity', label: 'Code Density' },
  { key: 'showFileCount', label: 'File Count' },
];

function formatDateInputValue(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function describeAutoRange(root: TreemapNode | null, settings: ExtensionSettings): string {
  const domain = resolveAgeColorDomain(root, {
    ...settings.treemap,
    ageColorRangeMode: 'auto',
  });

  if (!domain) {
    return 'Auto ignores missing/invalid timestamps (including 1970-like placeholders). No valid file dates are currently available.';
  }

  return `Auto currently spans ${formatDateInputValue(domain.oldestTimestamp)} → ${formatDateInputValue(domain.newestTimestamp)} and ignores missing/invalid timestamps (including 1970-like placeholders).`;
}

export function TreemapSettings({ settings, data, updateSettings }: Props) {
  const handleTooltipChange = (key: string, checked: boolean) => {
    const newTooltipSettings = {
      ...settings.tooltipSettings,
      [key]: checked,
    };
    updateSettings({ tooltipSettings: newTooltipSettings });
  };

  const tooltipOptions = TOOLTIP_OPTIONS.map((opt) => ({
    key: opt.key,
    label: opt.label,
    checked: settings.tooltipSettings[opt.key],
  }));

  const autoRangeDescription = useMemo(
    () => describeAutoRange(data?.fileTree ?? null, settings),
    [data, settings]
  );

  const seedCustomRangeFromAuto = () => {
    const autoDomain = resolveAgeColorDomain(data?.fileTree ?? null, {
      ...settings.treemap,
      ageColorRangeMode: 'auto',
    });

    updateSettings({
      treemap: {
        ageColorRangeMode: 'custom',
        ageColorNewestDate: autoDomain ? formatDateInputValue(autoDomain.newestTimestamp) : settings.treemap.ageColorNewestDate,
        ageColorOldestDate: autoDomain ? formatDateInputValue(autoDomain.oldestTimestamp) : settings.treemap.ageColorOldestDate,
      },
    });
  };

  return (
    <div className="settings-sections">
      <SelectSetting
        title="Default Color Mode"
        description="How to color files in the treemap view"
        value={settings.defaultColorMode}
        options={[
          { value: 'language', label: 'By Language' },
          { value: 'age', label: 'By File Age' },
          { value: 'complexity', label: 'By Complexity' },
          { value: 'density', label: 'By Code Density' },
        ]}
        onChange={(value) =>
          updateSettings({
            defaultColorMode: value as 'language' | 'age' | 'complexity' | 'density',
          })
        }
      />

      <div className="setting-section">
        <div className="setting-header">
          <div className="setting-header-main">
            <h3 className="setting-title">Age Color Range</h3>
            <p className="setting-description">
              Control how treemap age coloring maps dates to green and red. Auto uses the newest and oldest valid files in the current treemap view. Custom lets you pin the range manually.
            </p>
          </div>
        </div>

        <div className="select-row treemap-age-range-mode-row">
          <button
            className={`select-option ${settings.treemap.ageColorRangeMode === 'auto' ? 'active' : ''}`}
            onClick={() => updateSettings({
              treemap: {
                ...settings.treemap,
                ageColorRangeMode: 'auto',
              },
            })}
          >
            Auto
          </button>
          <button
            className={`select-option ${settings.treemap.ageColorRangeMode === 'custom' ? 'active' : ''}`}
            onClick={seedCustomRangeFromAuto}
          >
            Custom
          </button>
        </div>

        <p className="setting-hint treemap-age-range-hint">
          {settings.treemap.ageColorRangeMode === 'auto'
            ? autoRangeDescription
            : 'Files on or after the newest date render fully green. Files on or before the oldest date render fully red.'}
        </p>

        {settings.treemap.ageColorRangeMode === 'custom' && (
          <div className="treemap-age-range-grid">
            <label className="treemap-date-field">
              <span>Newest date (full green)</span>
              <input
                type="date"
                value={settings.treemap.ageColorNewestDate}
                onChange={(event) => updateSettings({
                  treemap: {
                    ...settings.treemap,
                    ageColorNewestDate: event.target.value,
                  },
                })}
              />
            </label>

            <label className="treemap-date-field">
              <span>Oldest date (full red)</span>
              <input
                type="date"
                value={settings.treemap.ageColorOldestDate}
                onChange={(event) => updateSettings({
                  treemap: {
                    ...settings.treemap,
                    ageColorOldestDate: event.target.value,
                  },
                })}
              />
            </label>
          </div>
        )}
      </div>

      <CheckboxGroupSetting
        title="Tooltip Contents"
        description="Choose which metrics to display in the treemap tooltip when hovering over files"
        options={tooltipOptions}
        onChange={handleTooltipChange}
      />
    </div>
  );
}
