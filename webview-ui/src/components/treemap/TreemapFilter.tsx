/**
 * Treemap Filter - Filter files by type presets or custom language selection.
 *
 * Uses local state for immediate visual feedback, syncing to the store
 * asynchronously to prevent blocking during expensive tree re-filtering.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import type { TreemapFilterPreset, TreemapNode } from '../../types';
import { InfoTooltip } from '../common/InfoTooltip';
import { LanguagePicker } from './LanguagePicker';
import './TreemapFilter.css';

const PRESETS: { id: TreemapFilterPreset; label: string; description: string }[] = [
  { id: 'all', label: 'All', description: 'Show all files including binaries' },
  { id: 'hide-binary', label: 'No Binary', description: 'Hide images, fonts, archives, etc.' },
  { id: 'code-only', label: 'Code Only', description: 'Hide JSON, YAML, Markdown, and binaries' },
  { id: 'custom', label: 'Custom', description: 'Select specific languages' },
];

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
        <span className="filter-label">
          Filter
          <InfoTooltip
            content="All: Show everything. No Binary: Hide images, fonts, archives. Code Only: Show only programming languages. Custom: Pick specific languages to display."
            position="bottom"
          />
        </span>
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
