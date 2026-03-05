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

export type FileFilterMode = 'all' | 'only' | 'exclude';

export interface FileFilterState {
  query: string;
  languages: string[];
  extensions: string[];
  locMin: number | null;
  locMax: number | null;
  bytesMin: number | null;
  bytesMax: number | null;
  complexityMin: number | null;
  complexityMax: number | null;
  commentMin: number | null;
  commentMax: number | null;
  blankMin: number | null;
  blankMax: number | null;
  modifiedAfter: string;
  modifiedBefore: string;
  generatedMode: FileFilterMode;
  binaryMode: FileFilterMode;
  codeOnly: boolean;
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
