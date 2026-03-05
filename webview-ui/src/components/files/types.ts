export interface FileRow {
  path: string;
  name: string;
  ext: string;
  language: string;
  lines: number;
  bytes: number;
  binary: boolean;
  generated: boolean;
  isCode: boolean;
  complexity: number;
  commentLines: number;
  blankLines: number;
  lastModified?: string;
  lastModifiedEpoch: number;

  // Normalized fields for faster filtering/sorting
  pathLower: string;
  nameLower: string;
}

export interface FileCatalog {
  rows: FileRow[];
  languages: string[];
  extensions: string[];
}

export type FileSortKey =
  | 'path'
  | 'name'
  | 'ext'
  | 'language'
  | 'lines'
  | 'bytes'
  | 'generated'
  | 'binary'
  | 'isCode'
  | 'complexity'
  | 'commentLines'
  | 'blankLines'
  | 'lastModified';

export type SortDirection = 'asc' | 'desc';

export interface SortRule {
  key: FileSortKey;
  direction: SortDirection;
}

export type ColumnFilterKind = 'text' | 'number' | 'boolean' | 'date';

export interface TextColumnFilter {
  kind: 'text';
  value: string;
}

export interface NumberColumnFilter {
  kind: 'number';
  min: string;
  max: string;
}

export interface BooleanColumnFilter {
  kind: 'boolean';
  mode: 'all' | 'true' | 'false';
}

export interface DateColumnFilter {
  kind: 'date';
  from: string;
  to: string;
}

export type ColumnFilter =
  | TextColumnFilter
  | NumberColumnFilter
  | BooleanColumnFilter
  | DateColumnFilter;

export type ColumnFilters = Partial<Record<FileSortKey, ColumnFilter>>;

export interface FileColumnConfig {
  key: FileSortKey;
  label: string;
  width: number;
  align?: 'left' | 'right';
  filterKind: ColumnFilterKind;
}
