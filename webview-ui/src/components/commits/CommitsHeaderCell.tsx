import { CommitColumnFilterPopover } from './CommitColumnFilterPopover';
import { isCommitColumnFilterActive } from './commitTableLogic';
import { FilterIcon } from '../files/FilterIcon';
import type { CommitColumnConfig, CommitColumnFilter, CommitColumnKey, CommitSortState } from './types';

interface Props {
  column: CommitColumnConfig;
  sortState: CommitSortState;
  activeFilterColumn: CommitColumnKey | null;
  filter: CommitColumnFilter | undefined;
  onSort: (key: CommitColumnKey) => void;
  onSetActiveFilterColumn: (key: CommitColumnKey | null) => void;
  onFilterChange: (key: CommitColumnKey, filter: CommitColumnFilter) => void;
  onFilterClear: (key: CommitColumnKey) => void;
}

function getSortIndicator(sortState: CommitSortState, key: CommitColumnKey): string {
  if (sortState.key !== key) {
    return '';
  }

  return sortState.direction === 'asc' ? '▲' : '▼';
}

export function CommitsHeaderCell({
  column,
  sortState,
  activeFilterColumn,
  filter,
  onSort,
  onSetActiveFilterColumn,
  onFilterChange,
  onFilterClear,
}: Props) {
  const isFilterActive = isCommitColumnFilterActive(filter);

  return (
    <div className={`commit-header-cell ${column.align === 'right' ? 'numeric' : ''}`} role="columnheader">
      <button
        type="button"
        className={`commit-header-sort-button ${column.align === 'right' ? 'numeric' : ''}`}
        onClick={() => onSort(column.key)}
        title="Click to sort"
      >
        <span>{column.label}</span>
        <span className="commit-sort-indicator">{getSortIndicator(sortState, column.key)}</span>
      </button>

      <div className="commit-header-actions">
        <div className="commit-header-filter-anchor">
          <button
            type="button"
            className={`commit-header-filter-button ${isFilterActive ? 'active' : ''}`}
            title={`Filter ${column.label}`}
            onClick={(event) => {
              event.stopPropagation();
              onSetActiveFilterColumn(activeFilterColumn === column.key ? null : column.key);
            }}
          >
            <FilterIcon />
          </button>

          {activeFilterColumn === column.key && (
            <CommitColumnFilterPopover
              column={column}
              filter={filter}
              onChange={(nextFilter) => onFilterChange(column.key, nextFilter)}
              onClear={() => onFilterClear(column.key)}
              onClose={() => onSetActiveFilterColumn(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
