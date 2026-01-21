/**
 * Granularity Toggle for Code Frequency panel.
 */

import type { FrequencyGranularity } from '../../types';

const GRANULARITY_OPTIONS: { id: FrequencyGranularity; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

interface Props {
  value: FrequencyGranularity;
  onChange: (value: FrequencyGranularity) => void;
}

export function FrequencyGranularityToggle({ value, onChange }: Props) {
  return (
    <div className="granularity-toggle">
      {GRANULARITY_OPTIONS.map((option) => (
        <button
          key={option.id}
          className={`toggle-button ${value === option.id ? 'active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
