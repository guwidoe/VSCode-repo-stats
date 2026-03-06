import type { MouseEvent as ReactMouseEvent } from 'react';
import { ColumnFilterPopover } from './ColumnFilterPopover';
import { FilterIcon } from './FilterIcon';
import { isColumnFilterActive } from './fileTableLogic';
import type { ColumnFilter, FileColumnConfig, FileSortKey, SortRule } from './types';

function getSortIndicator(sortRules: SortRule[], key: FileSortKey): string {
  const index = sortRules.findIndex((rule) => rule.key === key);
  if (index === -1) {
    return '';
  }

  const rule = sortRules[index];
  const arrow = rule.direction === 'asc' ? '▲' : '▼';
  return sortRules.length > 1 ? `${arrow}${index + 1}` : arrow;
}

interface FilesHeaderCellProps {
  column: FileColumnConfig & { width: number };
  sortRules: SortRule[];
  activeFilterColumn: FileSortKey | null;
  filter: ColumnFilter | undefined;
  onSort: (key: FileSortKey, multiColumn: boolean) => void;
  onSetActiveFilterColumn: (key: FileSortKey | null) => void;
  onHeaderMouseDown: (key: FileSortKey, event: ReactMouseEvent<HTMLDivElement>) => void;
  onHeaderMouseMove: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onHeaderMouseLeave: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onFilterChange: (key: FileSortKey, filter: ColumnFilter) => void;
  onFilterClear: (key: FileSortKey) => void;
  onCloseColumnManager: () => void;
}

export function FilesHeaderCell({
  column,
  sortRules,
  activeFilterColumn,
  filter,
  onSort,
  onSetActiveFilterColumn,
  onHeaderMouseDown,
  onHeaderMouseMove,
  onHeaderMouseLeave,
  onFilterChange,
  onFilterClear,
  onCloseColumnManager,
}: FilesHeaderCellProps) {
  const isFilterActive = isColumnFilterActive(filter);

  return (
    <div
      className={`files-header-cell ${column.align === 'right' ? 'numeric' : ''}`}
      role="columnheader"
      onMouseDownCapture={(event) => onHeaderMouseDown(column.key, event)}
      onMouseMove={onHeaderMouseMove}
      onMouseLeave={onHeaderMouseLeave}
    >
      <button
        type="button"
        className={`header-sort-button ${column.align === 'right' ? 'numeric' : ''}`}
        onClick={(event) => onSort(column.key, event.shiftKey)}
        title="Click to sort. Shift+click to add as secondary sort key."
      >
        <span>{column.label}</span>
        <span className="sort-indicator">{getSortIndicator(sortRules, column.key)}</span>
      </button>

      <div className="header-actions">
        <div className="header-filter-anchor">
          <button
            type="button"
            className={`header-filter-button ${isFilterActive ? 'active' : ''}`}
            title={`Filter ${column.label}`}
            onClick={(event) => {
              event.stopPropagation();
              onCloseColumnManager();
              onSetActiveFilterColumn(activeFilterColumn === column.key ? null : column.key);
            }}
          >
            <FilterIcon />
          </button>

          {activeFilterColumn === column.key && (
            <ColumnFilterPopover
              column={column}
              filter={filter}
              onChange={(nextFilter) => onFilterChange(column.key, nextFilter)}
              onClear={() => onFilterClear(column.key)}
              onClose={() => onSetActiveFilterColumn(null)}
            />
          )}
        </div>

        <div className="header-resize-hint" title="Drag right edge to resize column" />
      </div>
    </div>
  );
}
