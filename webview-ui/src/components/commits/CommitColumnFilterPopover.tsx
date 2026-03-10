import { createDefaultCommitFilter, isCommitColumnFilterActive } from './commitTableLogic';
import type {
  CommitColumnConfig,
  CommitColumnFilter,
  DateCommitColumnFilter,
  NumberCommitColumnFilter,
  TextCommitColumnFilter,
} from './types';

interface Props {
  column: CommitColumnConfig;
  filter: CommitColumnFilter | undefined;
  onChange: (filter: CommitColumnFilter) => void;
  onClear: () => void;
  onClose: () => void;
}

function getFilterValue(column: CommitColumnConfig, filter: CommitColumnFilter | undefined): CommitColumnFilter {
  if (filter && filter.kind === column.filterKind) {
    return filter;
  }
  return createDefaultCommitFilter(column.filterKind);
}

export function CommitColumnFilterPopover({
  column,
  filter,
  onChange,
  onClear,
  onClose,
}: Props) {
  const value = getFilterValue(column, filter);

  return (
    <div className="commit-column-filter-popover" onClick={(event) => event.stopPropagation()}>
      <div className="commit-popover-title">Filter: {column.label}</div>

      {value.kind === 'text' && (
        <label className="commit-popover-field">
          <span>Contains</span>
          <input
            type="text"
            value={(value as TextCommitColumnFilter).value}
            onChange={(event) => {
              onChange({ kind: 'text', value: event.target.value });
            }}
            placeholder={`Type to filter ${column.label.toLowerCase()}`}
          />
        </label>
      )}

      {value.kind === 'number' && (
        <>
          <label className="commit-popover-field">
            <span>Min</span>
            <input
              type="number"
              value={(value as NumberCommitColumnFilter).min}
              onChange={(event) => {
                onChange({
                  kind: 'number',
                  min: event.target.value,
                  max: (value as NumberCommitColumnFilter).max,
                });
              }}
            />
          </label>
          <label className="commit-popover-field">
            <span>Max</span>
            <input
              type="number"
              value={(value as NumberCommitColumnFilter).max}
              onChange={(event) => {
                onChange({
                  kind: 'number',
                  min: (value as NumberCommitColumnFilter).min,
                  max: event.target.value,
                });
              }}
            />
          </label>
        </>
      )}

      {value.kind === 'date' && (
        <>
          <label className="commit-popover-field">
            <span>From</span>
            <input
              type="date"
              value={(value as DateCommitColumnFilter).from}
              onChange={(event) => {
                onChange({
                  kind: 'date',
                  from: event.target.value,
                  to: (value as DateCommitColumnFilter).to,
                });
              }}
            />
          </label>
          <label className="commit-popover-field">
            <span>To</span>
            <input
              type="date"
              value={(value as DateCommitColumnFilter).to}
              onChange={(event) => {
                onChange({
                  kind: 'date',
                  from: (value as DateCommitColumnFilter).from,
                  to: event.target.value,
                });
              }}
            />
          </label>
        </>
      )}

      <div className="commit-popover-actions">
        <button
          type="button"
          className="commit-subtle-button"
          onClick={onClear}
          disabled={!isCommitColumnFilterActive(value)}
        >
          Clear
        </button>
        <button
          type="button"
          className="commit-subtle-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
