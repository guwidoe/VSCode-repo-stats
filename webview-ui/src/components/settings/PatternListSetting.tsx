/**
 * Pattern list setting component for editing array-based settings.
 */

import { useState } from 'react';

interface PatternListSettingProps {
  title: string;
  description: string;
  patterns: string[];
  onChange: (patterns: string[]) => void;
  placeholder?: string;
  headerContent?: React.ReactNode;
}

export function PatternListSetting({
  title,
  description,
  patterns,
  onChange,
  placeholder,
  headerContent,
}: PatternListSettingProps) {
  const [newPattern, setNewPattern] = useState('');

  const addPattern = () => {
    const trimmed = newPattern.trim();
    if (trimmed && !patterns.includes(trimmed)) {
      onChange([...patterns, trimmed]);
      setNewPattern('');
    }
  };

  const removePattern = (pattern: string) => {
    onChange(patterns.filter((p) => p !== pattern));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPattern();
    }
  };

  return (
    <div className="setting-section">
      <div className="setting-header">
        <div className="setting-header-main">
          <h3 className="setting-title">{title}</h3>
          <p className="setting-description">{description}</p>
        </div>
        {headerContent && <div className="setting-header-aside">{headerContent}</div>}
      </div>

      <div className="pattern-list">
        {patterns.map((pattern) => (
          <div key={pattern} className="pattern-tag">
            <span className="pattern-text">{pattern}</span>
            <button
              className="pattern-remove"
              onClick={() => removePattern(pattern)}
              aria-label={`Remove ${pattern}`}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <div className="pattern-input-row">
        <input
          type="text"
          className="pattern-input"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <button
          className="pattern-add-button"
          onClick={addPattern}
          disabled={!newPattern.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
