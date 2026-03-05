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
    case 'blamedLines':
      return row.blamedLines > 0 ? row.blamedLines.toLocaleString() : '—';
    case 'lineAgeAvgDays':
      return row.blamedLines > 0 ? row.lineAgeAvgDays.toLocaleString() : '—';
    case 'lineAgeMinDays':
      return row.blamedLines > 0 ? row.lineAgeMinDays.toLocaleString() : '—';
    case 'lineAgeMaxDays':
      return row.blamedLines > 0 ? row.lineAgeMaxDays.toLocaleString() : '—';
    case 'topOwnerAuthor':
      return row.topOwnerAuthor || '—';
    case 'topOwnerLines':
      return row.topOwnerLines > 0 ? row.topOwnerLines.toLocaleString() : '—';
    case 'topOwnerShare':
      return row.topOwnerLines > 0 ? `${(row.topOwnerShare * 100).toFixed(1)}%` : '—';
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
    case 'topOwnerAuthor':
      return row.topOwnerEmail || undefined;
    case 'topOwnerShare':
      return row.topOwnerLines > 0
        ? `${row.topOwnerLines.toLocaleString()} / ${row.blamedLines.toLocaleString()} lines`
        : undefined;
    case 'lastModified':
      return row.lastModified || 'Unknown';
    default:
      return undefined;
  }
}
