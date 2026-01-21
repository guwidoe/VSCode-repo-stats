/**
 * Language Picker - Multi-select for filtering treemap by languages.
 */

import { useState, useCallback, useMemo } from 'react';

interface Props {
  languages: string[];
  selected: Set<string>;
  onToggle: (language: string) => void;
}

export function LanguagePicker({ languages, selected, onToggle }: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = useMemo(() => {
    if (!searchQuery) {
      return languages;
    }
    const query = searchQuery.toLowerCase();
    return languages.filter((lang) => lang.toLowerCase().includes(query));
  }, [languages, searchQuery]);

  const handleSelectAll = useCallback(() => {
    // If all are selected, clear all. Otherwise, select all.
    const allSelected = languages.every((lang) => selected.has(lang));
    for (const lang of languages) {
      if (allSelected) {
        // Only toggle if currently selected
        if (selected.has(lang)) {
          onToggle(lang);
        }
      } else {
        // Only toggle if not selected
        if (!selected.has(lang)) {
          onToggle(lang);
        }
      }
    }
  }, [languages, selected, onToggle]);

  const allSelected = languages.length > 0 && languages.every((lang) => selected.has(lang));

  return (
    <div className="language-picker">
      <div className="picker-header">
        <input
          type="text"
          placeholder="Filter languages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="language-search"
        />
        <button className="select-all-btn" onClick={handleSelectAll}>
          {allSelected ? 'Clear All' : 'Select All'}
        </button>
      </div>
      <div className="language-list">
        {filteredLanguages.map((language) => (
          <label key={language} className="language-item">
            <input
              type="checkbox"
              checked={selected.has(language)}
              onChange={() => onToggle(language)}
            />
            <span className="language-name">{language}</span>
          </label>
        ))}
        {filteredLanguages.length === 0 && (
          <div className="no-languages">No languages match "{searchQuery}"</div>
        )}
      </div>
    </div>
  );
}
