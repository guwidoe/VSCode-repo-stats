import { DEFAULT_COLUMN_ORDER, getColumnConfig } from './columns';
import type { FileSortKey } from './types';

interface Props {
  columnOrder: FileSortKey[];
  hiddenColumns: Set<FileSortKey>;
  onToggleColumn: (key: FileSortKey) => void;
  onMoveColumn: (key: FileSortKey, direction: 'up' | 'down') => void;
  onResetColumns: () => void;
  onClose: () => void;
}

export function ColumnManagerPopover({
  columnOrder,
  hiddenColumns,
  onToggleColumn,
  onMoveColumn,
  onResetColumns,
  onClose,
}: Props) {
  return (
    <div className="column-manager-popover" onClick={(event) => event.stopPropagation()}>
      <div className="popover-title">Manage columns</div>
      <div className="column-manager-list">
        {columnOrder.map((key, index) => {
          const column = getColumnConfig(key);
          const isHidden = hiddenColumns.has(key);

          return (
            <div key={key} className="column-manager-row">
              <label>
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => onToggleColumn(key)}
                />
                <span>{column.label}</span>
              </label>
              <div className="column-order-buttons">
                <button
                  type="button"
                  className="order-button"
                  onClick={() => onMoveColumn(key, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="order-button"
                  onClick={() => onMoveColumn(key, 'down')}
                  disabled={index === columnOrder.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="popover-actions">
        <button
          type="button"
          className="subtle-button"
          onClick={() => {
            onResetColumns();
          }}
          disabled={columnOrder.every((key, index) => key === DEFAULT_COLUMN_ORDER[index]) && hiddenColumns.size === 0}
        >
          Reset columns
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
