/**
 * Select/toggle setting component.
 */

interface SelectSettingProps {
  title: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function SelectSetting({
  title,
  description,
  value,
  options,
  onChange,
}: SelectSettingProps) {
  return (
    <div className="setting-section">
      <div className="setting-header">
        <h3 className="setting-title">{title}</h3>
        <p className="setting-description">{description}</p>
      </div>

      <div className="select-row">
        {options.map((option) => (
          <button
            key={option.value}
            className={`select-option ${value === option.value ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
