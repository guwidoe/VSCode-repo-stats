import type { FileColumnConfig, FileSortKey } from './types';

export const FILE_COLUMNS: FileColumnConfig[] = [
  { key: 'path', label: 'Path', width: 320, filterKind: 'text' },
  { key: 'name', label: 'Name', width: 170, filterKind: 'text' },
  { key: 'ext', label: 'Ext', width: 90, filterKind: 'text' },
  { key: 'language', label: 'Language', width: 130, filterKind: 'text' },
  { key: 'lines', label: 'LOC', width: 90, align: 'right', filterKind: 'number' },
  { key: 'bytes', label: 'Size', width: 120, align: 'right', filterKind: 'number' },
  { key: 'generated', label: 'Generated', width: 100, filterKind: 'boolean' },
  { key: 'binary', label: 'Binary', width: 90, filterKind: 'boolean' },
  { key: 'isCode', label: 'Code', width: 80, filterKind: 'boolean' },
  { key: 'complexity', label: 'Complexity', width: 100, align: 'right', filterKind: 'number' },
  { key: 'commentLines', label: 'Comment', width: 90, align: 'right', filterKind: 'number' },
  { key: 'blankLines', label: 'Blank', width: 80, align: 'right', filterKind: 'number' },
  { key: 'lastModified', label: 'Last Modified', width: 150, filterKind: 'date' },
];

export const DEFAULT_COLUMN_ORDER: FileSortKey[] = FILE_COLUMNS.map((column) => column.key);

const columnMap = new Map<FileSortKey, FileColumnConfig>(
  FILE_COLUMNS.map((column) => [column.key, column])
);

export function getColumnConfig(key: FileSortKey): FileColumnConfig {
  const column = columnMap.get(key);
  if (!column) {
    throw new Error(`Unknown file column: ${key}`);
  }
  return column;
}
