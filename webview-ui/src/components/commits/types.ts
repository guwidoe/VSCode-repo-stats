import type { CommitRecord, CommitSortDirection } from '../../types';

export type CommitColumnKey =
  | 'committedAt'
  | 'authorName'
  | 'summary'
  | 'sha'
  | 'additions'
  | 'deletions'
  | 'changedLines'
  | 'filesChanged';

export type CommitColumnFilterKind = 'text' | 'number' | 'date';

export interface CommitTableRow extends CommitRecord {
  authorName: string;
  authorEmail: string;
  authorNameLower: string;
  summaryLower: string;
  shaLower: string;
}

export interface CommitColumnConfig {
  key: CommitColumnKey;
  label: string;
  width: number;
  align?: 'left' | 'right';
  filterKind: CommitColumnFilterKind;
}

export interface TextCommitColumnFilter {
  kind: 'text';
  value: string;
}

export interface NumberCommitColumnFilter {
  kind: 'number';
  min: string;
  max: string;
}

export interface DateCommitColumnFilter {
  kind: 'date';
  from: string;
  to: string;
}

export type CommitColumnFilter =
  | TextCommitColumnFilter
  | NumberCommitColumnFilter
  | DateCommitColumnFilter;

export type CommitColumnFilters = Partial<Record<CommitColumnKey, CommitColumnFilter>>;

export interface CommitSortState {
  key: CommitColumnKey;
  direction: CommitSortDirection;
}
