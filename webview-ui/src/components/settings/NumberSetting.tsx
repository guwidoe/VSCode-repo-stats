/**
 * Number input setting component.
 */

interface NumberSettingProps {
  title: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberSetting({
  title,
  description,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
}: NumberSettingProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue) && newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className="setting-section">
      <div className="setting-header">
        <h3 className="setting-title">{title}</h3>
        <p className="setting-description">{description}</p>
      </div>

      <div className="number-input-row">
        <input
          type="number"
          className="number-input"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
        />
        <span className="number-range">
          ({min.toLocaleString()} - {max.toLocaleString()})
        </span>
      </div>
    </div>
  );
}
