/**
 * Files panel with virtualized table, header filters, and flexible column layout.
 */

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../../store';
import { useFileCatalog } from '../../hooks/useFileCatalog';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { DEFAULT_COLUMN_ORDER, getColumnConfig } from './columns';
import { ColumnFilterPopover } from './ColumnFilterPopover';
import { ColumnManagerPopover } from './ColumnManagerPopover';
import { getCellContent, getCellTitle } from './fileCellFormatters';
import {
  DEFAULT_SORT_RULES,
  filterFiles,
  isColumnFilterActive,
  sortFiles,
  updateSortRules,
} from './fileTableLogic';
import type { ColumnFilter, ColumnFilters, FileSortKey, SortRule } from './types';
import './FilesPanel.css';

function getSortIndicator(sortRules: SortRule[], key: FileSortKey): string {
  const index = sortRules.findIndex((rule) => rule.key === key);
  if (index === -1) {
    return '';
  }

  const rule = sortRules[index];
  const arrow = rule.direction === 'asc' ? '▲' : '▼';
  return sortRules.length > 1 ? `${arrow}${index + 1}` : arrow;
}

export function FilesPanel() {
  const catalog = useFileCatalog();
  const settings = useStore((state) => state.settings);
  const data = useStore((state) => state.data);
  const { openFile } = useVsCodeApi();

  const [sortRules, setSortRules] = useState<SortRule[]>(DEFAULT_SORT_RULES);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [columnOrder, setColumnOrder] = useState<FileSortKey[]>(DEFAULT_COLUMN_ORDER);
  const [hiddenColumns, setHiddenColumns] = useState<Set<FileSortKey>>(() => new Set());
  const [activeFilterColumn, setActiveFilterColumn] = useState<FileSortKey | null>(null);
  const [showColumnManager, setShowColumnManager] = useState(false);

  const deferredFilters = useDeferredValue(columnFilters);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const visibleColumns = useMemo(
    () => columnOrder.filter((key) => !hiddenColumns.has(key)).map((key) => getColumnConfig(key)),
    [columnOrder, hiddenColumns]
  );

  const gridTemplateColumns = useMemo(
    () => visibleColumns.map((column) => `${column.width}px`).join(' '),
    [visibleColumns]
  );

  const minTableWidth = useMemo(
    () => visibleColumns.reduce((sum, column) => sum + column.width, 0),
    [visibleColumns]
  );

  const activeFilterCount = useMemo(
    () => Object.values(columnFilters).filter((filter) => isColumnFilterActive(filter)).length,
    [columnFilters]
  );

  const filteredRows = useMemo(() => {
    if (!catalog) {
      return [];
    }
    return filterFiles(catalog.rows, deferredFilters);
  }, [catalog, deferredFilters]);

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

  const setFilter = (key: FileSortKey, filter: ColumnFilter) => {
    setColumnFilters((prev) => ({ ...prev, [key]: filter }));
  };

  const clearFilter = (key: FileSortKey) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setActiveFilterColumn(null);
  };

  const handleSort = (key: FileSortKey, multiColumn: boolean) => {
    setSortRules((prev) => updateSortRules(prev, key, multiColumn));
  };

  const toggleColumnVisibility = (key: FileSortKey) => {
    const isCurrentlyHidden = hiddenColumns.has(key);

    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }

      const visibleCount = columnOrder.length - next.size;
      if (visibleCount <= 1) {
        return prev;
      }

      next.add(key);
      return next;
    });

    if (!isCurrentlyHidden) {
      clearFilter(key);
      if (activeFilterColumn === key) {
        setActiveFilterColumn(null);
      }
    }
  };

  const moveColumn = (key: FileSortKey, direction: 'up' | 'down') => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(key);
      if (index === -1) {
        return prev;
      }

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
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
      {data?.submodules && data.submodules.count > 0 && (
        <div className="submodule-note">
          {settings?.includeSubmodules
            ? 'Submodule files are included in this tab. Re-analyze after toggling the setting to refresh this list.'
            : 'Submodule files are currently excluded from this tab. Enable "Include Git Submodules in File Analysis" and re-analyze to include them.'}
        </div>
      )}

      <div className="files-toolbar">
        <div className="toolbar-left">
          <div className="toolbar-popover-anchor">
            <button
              className="toolbar-button"
              type="button"
              onClick={() => {
                setShowColumnManager((open) => !open);
                setActiveFilterColumn(null);
              }}
            >
              Columns
            </button>

            {showColumnManager && (
              <ColumnManagerPopover
                columnOrder={columnOrder}
                hiddenColumns={hiddenColumns}
                onToggleColumn={toggleColumnVisibility}
                onMoveColumn={moveColumn}
                onResetColumns={() => {
                  setColumnOrder(DEFAULT_COLUMN_ORDER);
                  setHiddenColumns(new Set());
                }}
                onClose={() => setShowColumnManager(false)}
              />
            )}
          </div>

          <button
            className="toolbar-button"
            type="button"
            onClick={clearAllFilters}
            disabled={activeFilterCount === 0}
          >
            Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          <button
            className="toolbar-button"
            type="button"
            onClick={() => setSortRules(DEFAULT_SORT_RULES)}
          >
            Reset sort
          </button>
        </div>

        <div className="results-summary">
          Showing <strong>{sortedRows.length.toLocaleString()}</strong> of{' '}
          <strong>{catalog.rows.length.toLocaleString()}</strong> files
        </div>
      </div>

      <div className="files-table-shell">
        <div className="files-table" style={{ minWidth: `${minTableWidth}px` }}>
          <div className="files-table-header" role="row" style={{ gridTemplateColumns }}>
            {visibleColumns.map((column) => {
              const isFilterActive = isColumnFilterActive(columnFilters[column.key]);

              return (
                <div
                  key={column.key}
                  className={`files-header-cell ${column.align === 'right' ? 'numeric' : ''}`}
                  role="columnheader"
                >
                  <button
                    type="button"
                    className={`header-sort-button ${column.align === 'right' ? 'numeric' : ''}`}
                    onClick={(event) => handleSort(column.key, event.shiftKey)}
                    title="Click to sort. Shift+click to add as secondary sort key."
                  >
                    <span>{column.label}</span>
                    <span className="sort-indicator">{getSortIndicator(sortRules, column.key)}</span>
                  </button>

                  <div className="header-filter-anchor">
                    <button
                      type="button"
                      className={`header-filter-button ${isFilterActive ? 'active' : ''}`}
                      title={`Filter ${column.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowColumnManager(false);
                        setActiveFilterColumn((current) => current === column.key ? null : column.key);
                      }}
                    >
                      ⚲
                    </button>

                    {activeFilterColumn === column.key && (
                      <ColumnFilterPopover
                        column={column}
                        filter={columnFilters[column.key]}
                        onChange={(filter) => setFilter(column.key, filter)}
                        onClear={() => clearFilter(column.key)}
                        onClose={() => setActiveFilterColumn(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="files-table-body" ref={tableContainerRef}>
            {sortedRows.length === 0 ? (
              <div className="files-empty">No files match the active column filters.</div>
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
                      style={{ transform: `translateY(${virtualRow.start}px)`, gridTemplateColumns }}
                      role="row"
                      onDoubleClick={() => openFile(row.path)}
                      title="Double click to open file"
                    >
                      {visibleColumns.map((column) => (
                        <div
                          key={column.key}
                          className={`files-cell ${column.align === 'right' ? 'numeric' : ''} ${column.key === 'path' || column.key === 'ext' ? 'monospace' : ''}`}
                          title={getCellTitle(row, column.key)}
                        >
                          {getCellContent(row, column.key)}
                        </div>
                      ))}
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
