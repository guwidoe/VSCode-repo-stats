/**
 * Treemap Settings - Configuration for the Treemap view.
 */

import type { ExtensionSettings } from '../../types';
import { SelectSetting } from './SelectSetting';

interface Props {
  settings: ExtensionSettings;
  updateSettings: (settings: Partial<ExtensionSettings>) => void;
}

export function TreemapSettings({ settings, updateSettings }: Props) {
  return (
    <div className="settings-sections">
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
  );
}
