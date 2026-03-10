import { DEFAULT_COMMIT_COLUMN_ORDER, getCommitColumnConfig } from './columns';
import type { CommitColumnKey } from './types';

interface Props {
  columnOrder: CommitColumnKey[];
  hiddenColumns: Set<CommitColumnKey>;
  onToggleColumn: (key: CommitColumnKey) => void;
  onMoveColumn: (key: CommitColumnKey, direction: 'up' | 'down') => void;
  onResetColumns: () => void;
  onClose: () => void;
}

export function CommitColumnManagerPopover({
  columnOrder,
  hiddenColumns,
  onToggleColumn,
  onMoveColumn,
  onResetColumns,
  onClose,
}: Props) {
  return (
    <div className="commit-column-manager-popover" onClick={(event) => event.stopPropagation()}>
      <div className="commit-popover-title">Manage columns</div>
      <div className="commit-column-manager-list">
        {columnOrder.map((key, index) => {
          const column = getCommitColumnConfig(key);
          const isHidden = hiddenColumns.has(key);

          return (
            <div key={key} className="commit-column-manager-row">
              <label>
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => onToggleColumn(key)}
                />
                <span>{column.label}</span>
              </label>
              <div className="commit-column-order-buttons">
                <button
                  type="button"
                  className="commit-order-button"
                  onClick={() => onMoveColumn(key, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="commit-order-button"
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
      <div className="commit-popover-actions">
        <button
          type="button"
          className="commit-subtle-button"
          onClick={onResetColumns}
          disabled={columnOrder.every((key, index) => key === DEFAULT_COMMIT_COLUMN_ORDER[index]) && hiddenColumns.size === 0}
        >
          Reset columns
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
