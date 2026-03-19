/**
 * Files panel with virtualized table, header filters, and flexible column layout.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, Columns3 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../../store';
import { useFileCatalog } from '../../hooks/useFileCatalog';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { buildDefaultColumnWidths, DEFAULT_COLUMN_ORDER, getColumnConfig } from './columns';
import { DataGridFrame } from '../datagrid/DataGridFrame';
import { DataGridToolbar } from '../datagrid/DataGridToolbar';
import { ColumnManagerPopover } from './ColumnManagerPopover';
import { FilesHeaderCell } from './FilesHeaderCell';
import { FilesTableRow } from './FilesTableRow';
import {
  DEFAULT_SORT_RULES,
  filterFiles,
  isColumnFilterActive,
  sortFiles,
  updateSortRules,
} from './fileTableLogic';
import type { ColumnFilter, ColumnFilters, FileSortKey, SortRule } from './types';
import './FilesPanel.css';

export function FilesPanel() {
  const catalog = useFileCatalog();
  const settings = useStore((state) => state.settings);
  const data = useStore((state) => state.data);
  const { openFile, revealInExplorer } = useVsCodeApi();

  const [sortRules, setSortRules] = useState<SortRule[]>(DEFAULT_SORT_RULES);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [columnOrder, setColumnOrder] = useState<FileSortKey[]>(DEFAULT_COLUMN_ORDER);
  const [columnWidths, setColumnWidths] = useState<Record<FileSortKey, number>>(() => buildDefaultColumnWidths());
  const [hiddenColumns, setHiddenColumns] = useState<Set<FileSortKey>>(() => new Set());
  const [activeFilterColumn, setActiveFilterColumn] = useState<FileSortKey | null>(null);
  const [showColumnManager, setShowColumnManager] = useState(false);

  const deferredFilters = useDeferredValue(columnFilters);
  const panelRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target)) {
        setShowColumnManager(false);
        setActiveFilterColumn(null);
      }
    };

    window.addEventListener('mousedown', onWindowMouseDown);
    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown);
    };
  }, []);

  const visibleColumns = useMemo(
    () => columnOrder
      .filter((key) => !hiddenColumns.has(key))
      .map((key) => {
        const config = getColumnConfig(key);
        return {
          ...config,
          width: columnWidths[key] ?? config.width,
        };
      }),
    [columnOrder, hiddenColumns, columnWidths]
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

  const startColumnResize = (key: FileSortKey, startX: number) => {
    const baseWidth = columnWidths[key] ?? getColumnConfig(key).width;

    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.max(72, Math.min(900, baseWidth + delta));

      setColumnWidths((prev) => ({
        ...prev,
        [key]: nextWidth,
      }));
    };

    const onMouseUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const isInResizeHotZone = (
    event: ReactMouseEvent<HTMLElement>,
    element: HTMLElement,
    hotZonePx: number = 10
  ) => {
    const rect = element.getBoundingClientRect();
    return rect.right - event.clientX <= hotZonePx;
  };

  const handleHeaderMouseDown = (key: FileSortKey, event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('.header-filter-anchor')) {
      return;
    }

    if (!isInResizeHotZone(event, event.currentTarget)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    startColumnResize(key, event.clientX);
  };

  const handleHeaderMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.currentTarget.style.cursor = isInResizeHotZone(event, event.currentTarget)
      ? 'col-resize'
      : '';
  };

  const handleHeaderMouseLeave = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.currentTarget.style.cursor = '';
  };

  if (!catalog) {
    return (
      <div className="files-panel">
        <div className="empty-state">No file data available</div>
      </div>
    );
  }

  return (
    <div className="files-panel" ref={panelRef}>
      {data && data.repositories.length > 1 && (
        <div className="submodule-note">
          This file list aggregates {data.repositories.length} repositories into one target.
        </div>
      )}

      <DataGridToolbar
        className="files-toolbar"
        start={(
          <div className="toolbar-left">
            <div className="toolbar-popover-anchor">
              <button
                className="toolbar-button column-selector-button"
                type="button"
                onClick={() => {
                  setShowColumnManager((open) => !open);
                  setActiveFilterColumn(null);
                }}
              >
                <Columns3 size={15} />
                <span>Columns</span>
                <ChevronDown size={14} />
              </button>

              {showColumnManager && (
                <ColumnManagerPopover
                  columnOrder={columnOrder}
                  hiddenColumns={hiddenColumns}
                  onToggleColumn={toggleColumnVisibility}
                  onMoveColumn={moveColumn}
                  onResetColumns={() => {
                    setColumnOrder(DEFAULT_COLUMN_ORDER);
                    setColumnWidths(buildDefaultColumnWidths());
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
        )}
        summary={(
          <div className="results-summary">
            Showing <strong>{sortedRows.length.toLocaleString()}</strong> of{' '}
            <strong>{catalog.rows.length.toLocaleString()}</strong> files
          </div>
        )}
      />

      <DataGridFrame
        className="files-table-shell"
        tableClassName="files-table"
        bodyClassName="files-table-body"
        bodyRef={tableContainerRef}
        minWidth={minTableWidth}
        header={(
          <div className="files-table-header" role="row" style={{ gridTemplateColumns }}>
            {visibleColumns.map((column) => (
              <FilesHeaderCell
                key={column.key}
                column={column}
                sortRules={sortRules}
                activeFilterColumn={activeFilterColumn}
                filter={columnFilters[column.key]}
                onSort={handleSort}
                onSetActiveFilterColumn={setActiveFilterColumn}
                onHeaderMouseDown={handleHeaderMouseDown}
                onHeaderMouseMove={handleHeaderMouseMove}
                onHeaderMouseLeave={handleHeaderMouseLeave}
                onFilterChange={setFilter}
                onFilterClear={clearFilter}
                onCloseColumnManager={() => setShowColumnManager(false)}
              />
            ))}
          </div>
        )}
      >
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
                <FilesTableRow
                  key={row.path}
                  row={row}
                  columns={visibleColumns}
                  gridTemplateColumns={gridTemplateColumns}
                  start={virtualRow.start}
                  onOpenFile={openFile}
                  onRevealInExplorer={revealInExplorer}
                />
              );
            })}
          </div>
        )}
      </DataGridFrame>
    </div>
  );
}
