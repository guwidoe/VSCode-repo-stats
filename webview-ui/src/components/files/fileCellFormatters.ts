import type { ReactNode } from 'react';
import { formatBytes, formatRelativeTime } from '../../utils/colors';
import type { FileRow, FileSortKey } from './types';

export function getCellContent(row: FileRow, key: FileSortKey): ReactNode {
  switch (key) {
    case 'path':
      return row.path;
    case 'name':
      return row.name;
    case 'ext':
      return row.ext;
    case 'language':
      return row.language;
    case 'lines':
      return row.lines.toLocaleString();
    case 'bytes':
      return formatBytes(row.bytes);
    case 'generated':
      return row.generated ? 'Yes' : 'No';
    case 'binary':
      return row.binary ? 'Yes' : 'No';
    case 'isCode':
      return row.isCode ? 'Yes' : 'No';
    case 'complexity':
      return row.complexity.toLocaleString();
    case 'commentLines':
      return row.commentLines.toLocaleString();
    case 'blankLines':
      return row.blankLines.toLocaleString();
    case 'lastModified':
      return row.lastModified ? formatRelativeTime(row.lastModified) : '—';
    default:
      return '';
  }
}

export function getCellTitle(row: FileRow, key: FileSortKey): string | undefined {
  switch (key) {
    case 'path':
      return row.path;
    case 'name':
      return row.name;
    case 'language':
      return row.language;
    case 'bytes':
      return `${row.bytes.toLocaleString()} B`;
    case 'lastModified':
      return row.lastModified || 'Unknown';
    default:
      return undefined;
  }
}
