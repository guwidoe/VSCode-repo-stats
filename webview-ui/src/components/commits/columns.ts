import type { CommitColumnConfig, CommitColumnKey } from './types';

const COMMIT_COLUMNS: Record<CommitColumnKey, CommitColumnConfig> = {
  committedAt: { key: 'committedAt', label: 'Date', width: 120, align: 'left', filterKind: 'date' },
  authorName: { key: 'authorName', label: 'Author', width: 170, align: 'left', filterKind: 'text' },
  summary: { key: 'summary', label: 'Summary', width: 420, align: 'left', filterKind: 'text' },
  sha: { key: 'sha', label: 'SHA', width: 100, align: 'left', filterKind: 'text' },
  additions: { key: 'additions', label: '+Add', width: 92, align: 'right', filterKind: 'number' },
  deletions: { key: 'deletions', label: '-Del', width: 92, align: 'right', filterKind: 'number' },
  changedLines: { key: 'changedLines', label: 'Δ Lines', width: 100, align: 'right', filterKind: 'number' },
  filesChanged: { key: 'filesChanged', label: 'Files', width: 78, align: 'right', filterKind: 'number' },
};

export const DEFAULT_COMMIT_COLUMN_ORDER: CommitColumnKey[] = [
  'committedAt',
  'authorName',
  'summary',
  'sha',
  'additions',
  'deletions',
  'changedLines',
  'filesChanged',
];

export function getCommitColumnConfig(key: CommitColumnKey): CommitColumnConfig {
  return COMMIT_COLUMNS[key];
}
