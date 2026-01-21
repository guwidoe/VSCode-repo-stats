/**
 * Treemap Filter - Filter files by type presets or custom language selection.
 *
 * Uses local state for immediate visual feedback, syncing to the store
 * asynchronously to prevent blocking during expensive tree re-filtering.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import type { TreemapFilterPreset, TreemapNode } from '../../types';
import './TreemapFilter.css';

const PRESETS: { id: TreemapFilterPreset; label: string; description: string }[] = [
  { id: 'all', label: 'All', description: 'Show all files including binaries' },
  { id: 'hide-binary', label: 'No Binary', description: 'Hide images, fonts, archives, etc.' },
  { id: 'code-only', label: 'Code Only', description: 'Hide JSON, YAML, Markdown, and binaries' },
  { id: 'custom', label: 'Custom', description: 'Select specific languages' },
];

export function TreemapFilter() {
  const treemapFilter = useStore((state) => state.treemapFilter);
  const setTreemapFilterPreset = useStore((state) => state.setTreemapFilterPreset);
  const toggleTreemapLanguage = useStore((state) => state.toggleTreemapLanguage);
  const currentTreemapNode = useStore((state) => state.currentTreemapNode);

  // Local state for immediate feedback
  const [localPreset, setLocalPreset] = useState<TreemapFilterPreset>(treemapFilter.preset);
  const [showLanguagePicker, setShowLanguagePicker] = useState(treemapFilter.preset === 'custom');

  // Sync local state if store changes from elsewhere
  useEffect(() => {
    setLocalPreset(treemapFilter.preset);
    setShowLanguagePicker(treemapFilter.preset === 'custom');
  }, [treemapFilter.preset]);

  // Extract unique languages from current tree (unfiltered)
  const availableLanguages = useMemo(() => {
    const data = useStore.getState().data;
    if (!data?.fileTree) {
      return [];
    }
    const languages = new Set<string>();
    collectLanguages(data.fileTree, languages);
    return Array.from(languages).sort();
  }, [currentTreemapNode]);

  const handlePresetChange = useCallback((preset: TreemapFilterPreset) => {
    // Immediate local update
    setLocalPreset(preset);
    setShowLanguagePicker(preset === 'custom');

    // Async store update
    requestAnimationFrame(() => {
      setTreemapFilterPreset(preset);
    });
  }, [setTreemapFilterPreset]);

  const handleLanguageToggle = useCallback((language: string) => {
    requestAnimationFrame(() => {
      toggleTreemapLanguage(language);
    });
  }, [toggleTreemapLanguage]);

  return (
    <div className="treemap-filter">
      <div className="filter-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={`preset-btn ${localPreset === preset.id ? 'active' : ''}`}
            onClick={() => handlePresetChange(preset.id)}
            title={preset.description}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {showLanguagePicker && (
        <LanguagePicker
          languages={availableLanguages}
          selected={treemapFilter.selectedLanguages}
          onToggle={handleLanguageToggle}
        />
      )}
    </div>
  );
}

interface LanguagePickerProps {
  languages: string[];
  selected: Set<string>;
  onToggle: (language: string) => void;
}

function LanguagePicker({ languages, selected, onToggle }: LanguagePickerProps) {
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

/**
 * Recursively collects all unique languages from a tree.
 */
function collectLanguages(node: TreemapNode, languages: Set<string>): void {
  if (node.type === 'file' && node.language) {
    languages.add(node.language);
  }
  for (const child of node.children || []) {
    collectLanguages(child, languages);
  }
}
