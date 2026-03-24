/**
 * Select/toggle setting component.
 */

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectSettingProps<T extends string> {
  title: string;
  description: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  headerContent?: React.ReactNode;
}

export function SelectSetting<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
  headerContent,
}: SelectSettingProps<T>) {
  return (
    <div className="setting-section">
      <div className="setting-header">
        <div className="setting-header-main">
          <h3 className="setting-title">{title}</h3>
          <p className="setting-description">{description}</p>
        </div>
        {headerContent && <div className="setting-header-aside">{headerContent}</div>}
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
