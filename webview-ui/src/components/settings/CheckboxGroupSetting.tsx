/**
 * Checkbox group setting component for multi-select boolean options.
 */

interface CheckboxOption {
  key: string;
  label: string;
  checked: boolean;
}

interface CheckboxGroupSettingProps {
  title: string;
  description: string;
  options: CheckboxOption[];
  onChange: (key: string, checked: boolean) => void;
}

export function CheckboxGroupSetting({
  title,
  description,
  options,
  onChange,
}: CheckboxGroupSettingProps) {
  return (
    <div className="setting-section">
      <div className="setting-header">
        <h3 className="setting-title">{title}</h3>
        <p className="setting-description">{description}</p>
      </div>

      <div className="checkbox-group">
        {options.map((option) => (
          <label key={option.key} className="checkbox-option">
            <input
              type="checkbox"
              checked={option.checked}
              onChange={(e) => onChange(option.key, e.target.checked)}
            />
            <span className="checkbox-label">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
