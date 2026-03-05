/**
 * Files panel with high-performance filtering, sorting, and virtualization.
 */

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFileCatalog } from '../../hooks/useFileCatalog';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { formatBytes, formatRelativeTime } from '../../utils/colors';
import {
  DEFAULT_SORT_RULES,
  filterFiles,
  sortFiles,
  updateSortRules,
} from './fileTableLogic';
import type { FileFilterState, FileSortKey, SortRule } from './types';
import './FilesPanel.css';

const INITIAL_FILTERS: FileFilterState = {
  query: '',
  languages: [],
  extensions: [],
  locMin: null,
  locMax: null,
  bytesMin: null,
  bytesMax: null,
  complexityMin: null,
  complexityMax: null,
  commentMin: null,
  commentMax: null,
  blankMin: null,
  blankMax: null,
  modifiedAfter: '',
  modifiedBefore: '',
  generatedMode: 'all',
  binaryMode: 'all',
  codeOnly: false,
};

interface ColumnConfig {
  key: FileSortKey;
  label: string;
  numeric?: boolean;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'path', label: 'Path' },
  { key: 'name', label: 'Name' },
  { key: 'ext', label: 'Ext' },
  { key: 'language', label: 'Language' },
  { key: 'lines', label: 'LOC', numeric: true },
  { key: 'bytes', label: 'Size', numeric: true },
  { key: 'generated', label: 'Generated' },
  { key: 'binary', label: 'Binary' },
  { key: 'isCode', label: 'Code' },
  { key: 'complexity', label: 'Complexity', numeric: true },
  { key: 'commentLines', label: 'Comment', numeric: true },
  { key: 'blankLines', label: 'Blank', numeric: true },
  { key: 'lastModified', label: 'Last Modified' },
];

function parseNullableNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function FilesPanel() {
  const catalog = useFileCatalog();
  const { openFile } = useVsCodeApi();

  const [filters, setFilters] = useState<FileFilterState>(INITIAL_FILTERS);
  const [sortRules, setSortRules] = useState<SortRule[]>(DEFAULT_SORT_RULES);

  const deferredQuery = useDeferredValue(filters.query);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const effectiveFilters = useMemo(
    () => ({ ...filters, query: deferredQuery }),
    [filters, deferredQuery]
  );

  const filteredRows = useMemo(() => {
    if (!catalog) {
      return [];
    }
    return filterFiles(catalog.rows, effectiveFilters);
  }, [catalog, effectiveFilters]);

  const sortedRows = useMemo(
    () => sortFiles(filteredRows, sortRules),
    [filteredRows, sortRules]
  );

  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 34,
    overscan: 14,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const updateFilter = <K extends keyof FileFilterState>(key: K, value: FileFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSort = (key: FileSortKey, multiColumn: boolean) => {
    setSortRules((prev) => updateSortRules(prev, key, multiColumn));
  };

  const getSortIndicator = (key: FileSortKey): string => {
    const index = sortRules.findIndex((rule) => rule.key === key);
    if (index === -1) {
      return '';
    }

    const rule = sortRules[index];
    const arrow = rule.direction === 'asc' ? '▲' : '▼';
    return sortRules.length > 1 ? `${arrow}${index + 1}` : arrow;
  };

  if (!catalog) {
    return (
      <div className="files-panel">
        <div className="empty-state">No file data available</div>
      </div>
    );
  }

  return (
    <div className="files-panel">
      <div className="files-controls">
        <div className="files-controls-row">
          <label className="control-field search-field">
            <span>Search path/name</span>
            <input
              type="text"
              value={filters.query}
              placeholder="src/components/button"
              onChange={(event) => updateFilter('query', event.target.value)}
            />
          </label>

          <label className="control-field checkbox-field">
            <span>Code only</span>
            <input
              type="checkbox"
              checked={filters.codeOnly}
              onChange={(event) => updateFilter('codeOnly', event.target.checked)}
            />
          </label>

          <label className="control-field compact-select">
            <span>Generated</span>
            <select
              value={filters.generatedMode}
              onChange={(event) => updateFilter('generatedMode', event.target.value as FileFilterState['generatedMode'])}
            >
              <option value="all">All</option>
              <option value="only">Only generated</option>
              <option value="exclude">Exclude generated</option>
            </select>
          </label>

          <label className="control-field compact-select">
            <span>Binary</span>
            <select
              value={filters.binaryMode}
              onChange={(event) => updateFilter('binaryMode', event.target.value as FileFilterState['binaryMode'])}
            >
              <option value="all">All</option>
              <option value="only">Only binary</option>
              <option value="exclude">Hide binary</option>
            </select>
          </label>

          <button
            className="reset-filters-button"
            onClick={() => {
              setFilters(INITIAL_FILTERS);
              setSortRules(DEFAULT_SORT_RULES);
            }}
          >
            Reset filters
          </button>
        </div>

        <div className="files-controls-row">
          <label className="control-field numeric-range">
            <span>LOC min</span>
            <input
              type="number"
              value={filters.locMin ?? ''}
              onChange={(event) => updateFilter('locMin', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field numeric-range">
            <span>LOC max</span>
            <input
              type="number"
              value={filters.locMax ?? ''}
              onChange={(event) => updateFilter('locMax', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field numeric-range">
            <span>Size min (B)</span>
            <input
              type="number"
              value={filters.bytesMin ?? ''}
              onChange={(event) => updateFilter('bytesMin', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field numeric-range">
            <span>Size max (B)</span>
            <input
              type="number"
              value={filters.bytesMax ?? ''}
              onChange={(event) => updateFilter('bytesMax', parseNullableNumber(event.target.value))}
            />
          </label>
        </div>

        <div className="files-controls-row">
          <label className="control-field numeric-range">
            <span>Complexity min</span>
            <input
              type="number"
              value={filters.complexityMin ?? ''}
              onChange={(event) => updateFilter('complexityMin', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field numeric-range">
            <span>Complexity max</span>
            <input
              type="number"
              value={filters.complexityMax ?? ''}
              onChange={(event) => updateFilter('complexityMax', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field numeric-range">
            <span>Comment min</span>
            <input
              type="number"
              value={filters.commentMin ?? ''}
              onChange={(event) => updateFilter('commentMin', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field numeric-range">
            <span>Comment max</span>
            <input
              type="number"
              value={filters.commentMax ?? ''}
              onChange={(event) => updateFilter('commentMax', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field numeric-range">
            <span>Blank min</span>
            <input
              type="number"
              value={filters.blankMin ?? ''}
              onChange={(event) => updateFilter('blankMin', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field numeric-range">
            <span>Blank max</span>
            <input
              type="number"
              value={filters.blankMax ?? ''}
              onChange={(event) => updateFilter('blankMax', parseNullableNumber(event.target.value))}
            />
          </label>
          <label className="control-field date-range">
            <span>Modified after</span>
            <input
              type="date"
              value={filters.modifiedAfter}
              onChange={(event) => updateFilter('modifiedAfter', event.target.value)}
            />
          </label>
          <label className="control-field date-range">
            <span>Modified before</span>
            <input
              type="date"
              value={filters.modifiedBefore}
              onChange={(event) => updateFilter('modifiedBefore', event.target.value)}
            />
          </label>
        </div>

        <div className="files-controls-row">
          <label className="control-field multi-select-field">
            <span>Language (multi-select)</span>
            <select
              multiple
              size={4}
              value={filters.languages}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                updateFilter('languages', values);
              }}
            >
              {catalog.languages.map((language) => (
                <option key={language} value={language}>{language}</option>
              ))}
            </select>
          </label>

          <label className="control-field multi-select-field">
            <span>Extension (multi-select)</span>
            <select
              multiple
              size={4}
              value={filters.extensions}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                updateFilter('extensions', values);
              }}
            >
              {catalog.extensions.map((ext) => (
                <option key={ext} value={ext}>{ext}</option>
              ))}
            </select>
          </label>

          <div className="results-summary">
            Showing <strong>{sortedRows.length.toLocaleString()}</strong> of{' '}
            <strong>{catalog.rows.length.toLocaleString()}</strong> files
          </div>
        </div>
      </div>

      <div className="files-table-shell">
        <div className="files-table">
          <div className="files-table-header" role="row">
            {COLUMNS.map((column) => (
              <button
                key={column.key}
                type="button"
                className={`files-header-cell ${column.numeric ? 'numeric' : ''}`}
                onClick={(event) => handleSort(column.key, event.shiftKey)}
                title="Click to sort. Shift+click to add as secondary sort key."
              >
                <span>{column.label}</span>
                <span className="sort-indicator">{getSortIndicator(column.key)}</span>
              </button>
            ))}
          </div>

          <div className="files-table-body" ref={tableContainerRef}>
            {sortedRows.length === 0 ? (
              <div className="files-empty">No files match the current filters.</div>
            ) : (
              <div
                className="files-virtualizer-space"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {virtualRows.map((virtualRow) => {
                  const row = sortedRows[virtualRow.index];

                  return (
                    <div
                      key={row.path}
                      className="files-table-row"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                      role="row"
                      onDoubleClick={() => openFile(row.path)}
                      title="Double click to open file"
                    >
                      <div className="files-cell path" title={row.path}>{row.path}</div>
                      <div className="files-cell" title={row.name}>{row.name}</div>
                      <div className="files-cell monospace">{row.ext}</div>
                      <div className="files-cell" title={row.language}>{row.language}</div>
                      <div className="files-cell numeric">{row.lines.toLocaleString()}</div>
                      <div className="files-cell numeric" title={`${row.bytes.toLocaleString()} B`}>
                        {formatBytes(row.bytes)}
                      </div>
                      <div className="files-cell">{row.generated ? 'Yes' : 'No'}</div>
                      <div className="files-cell">{row.binary ? 'Yes' : 'No'}</div>
                      <div className="files-cell">{row.isCode ? 'Yes' : 'No'}</div>
                      <div className="files-cell numeric">{row.complexity.toLocaleString()}</div>
                      <div className="files-cell numeric">{row.commentLines.toLocaleString()}</div>
                      <div className="files-cell numeric">{row.blankLines.toLocaleString()}</div>
                      <div className="files-cell" title={row.lastModified || 'Unknown'}>
                        {row.lastModified ? formatRelativeTime(row.lastModified) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
