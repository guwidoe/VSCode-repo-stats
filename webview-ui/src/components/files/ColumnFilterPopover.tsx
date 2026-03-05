import {
  createDefaultFilter,
  isColumnFilterActive,
} from './fileTableLogic';
import type {
  BooleanColumnFilter,
  ColumnFilter,
  DateColumnFilter,
  FileColumnConfig,
  NumberColumnFilter,
  TextColumnFilter,
} from './types';

interface Props {
  column: FileColumnConfig;
  filter: ColumnFilter | undefined;
  onChange: (filter: ColumnFilter) => void;
  onClear: () => void;
  onClose: () => void;
}

function getFilterValue(column: FileColumnConfig, filter: ColumnFilter | undefined): ColumnFilter {
  if (filter && filter.kind === column.filterKind) {
    return filter;
  }
  return createDefaultFilter(column.filterKind);
}

export function ColumnFilterPopover({
  column,
  filter,
  onChange,
  onClear,
  onClose,
}: Props) {
  const value = getFilterValue(column, filter);

  return (
    <div className="column-filter-popover" onClick={(event) => event.stopPropagation()}>
      <div className="popover-title">Filter: {column.label}</div>

      {value.kind === 'text' && (
        <label className="popover-field">
          <span>Contains</span>
          <input
            type="text"
            value={(value as TextColumnFilter).value}
            onChange={(event) => {
              onChange({ kind: 'text', value: event.target.value });
            }}
            placeholder={`Type to filter ${column.label.toLowerCase()}`}
          />
        </label>
      )}

      {value.kind === 'number' && (
        <>
          <label className="popover-field">
            <span>Min</span>
            <input
              type="number"
              value={(value as NumberColumnFilter).min}
              onChange={(event) => {
                onChange({
                  kind: 'number',
                  min: event.target.value,
                  max: (value as NumberColumnFilter).max,
                });
              }}
            />
          </label>
          <label className="popover-field">
            <span>Max</span>
            <input
              type="number"
              value={(value as NumberColumnFilter).max}
              onChange={(event) => {
                onChange({
                  kind: 'number',
                  min: (value as NumberColumnFilter).min,
                  max: event.target.value,
                });
              }}
            />
          </label>
        </>
      )}

      {value.kind === 'boolean' && (
        <label className="popover-field">
          <span>Value</span>
          <select
            value={(value as BooleanColumnFilter).mode}
            onChange={(event) => {
              onChange({
                kind: 'boolean',
                mode: event.target.value as BooleanColumnFilter['mode'],
              });
            }}
          >
            <option value="all">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      )}

      {value.kind === 'date' && (
        <>
          <label className="popover-field">
            <span>From</span>
            <input
              type="date"
              value={(value as DateColumnFilter).from}
              onChange={(event) => {
                onChange({
                  kind: 'date',
                  from: event.target.value,
                  to: (value as DateColumnFilter).to,
                });
              }}
            />
          </label>
          <label className="popover-field">
            <span>To</span>
            <input
              type="date"
              value={(value as DateColumnFilter).to}
              onChange={(event) => {
                onChange({
                  kind: 'date',
                  from: (value as DateColumnFilter).from,
                  to: event.target.value,
                });
              }}
            />
          </label>
        </>
      )}

      <div className="popover-actions">
        <button
          type="button"
          className="subtle-button"
          onClick={onClear}
          disabled={!isColumnFilterActive(value)}
        >
          Clear
        </button>
        <button
          type="button"
          className="subtle-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
