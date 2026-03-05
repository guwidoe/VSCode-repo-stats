/**
 * Hook that flattens the repository tree into a file catalog for the Files tab.
 */

import { useMemo } from 'react';
import { useStore } from '../store';
import type { TreemapNode } from '../types';
import { buildBinaryExtensionSet, isBinaryFile, isCodeLanguage } from '../utils/fileTypes';
import { DEFAULT_GENERATED_PATTERNS, getFileExtension, isGeneratedFile } from '../utils/fileClassification';
import type { FileCatalog, FileRow } from '../components/files/types';

function toEpoch(dateValue: string | undefined): number {
  if (!dateValue) {
    return 0;
  }

  const epoch = Date.parse(dateValue);
  return Number.isFinite(epoch) ? epoch : 0;
}

function flattenTree(
  node: TreemapNode,
  rows: FileRow[],
  generatedPatterns: string[],
  binaryExtensions: Set<string>,
  languages: Set<string>,
  extensions: Set<string>
): void {
  if (node.type === 'file') {
    const ext = getFileExtension(node.name);
    const binary =
      node.binary === true ||
      ((node.lines || 0) === 0 && isBinaryFile(node.path, binaryExtensions));
    const language = node.language || 'Unknown';
    const generated = isGeneratedFile(node.path, generatedPatterns);

    const row: FileRow = {
      path: node.path,
      name: node.name,
      ext,
      language,
      lines: node.lines || 0,
      bytes: node.bytes || 0,
      binary,
      generated,
      isCode: isCodeLanguage(language),
      complexity: node.complexity || 0,
      commentLines: node.commentLines || 0,
      blankLines: node.blankLines || 0,
      lastModified: node.lastModified,
      lastModifiedEpoch: toEpoch(node.lastModified),
      pathLower: node.path.toLowerCase(),
      nameLower: node.name.toLowerCase(),
    };

    rows.push(row);
    languages.add(language);
    extensions.add(ext);
    return;
  }

  for (const child of node.children || []) {
    flattenTree(child, rows, generatedPatterns, binaryExtensions, languages, extensions);
  }
}

export function buildFileCatalog(
  fileTree: TreemapNode,
  generatedPatterns: string[],
  binaryExtensions: Set<string>
): FileCatalog {
  const rows: FileRow[] = [];
  const languageSet = new Set<string>();
  const extensionSet = new Set<string>();

  flattenTree(
    fileTree,
    rows,
    generatedPatterns,
    binaryExtensions,
    languageSet,
    extensionSet
  );

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

  return {
    rows,
    languages: Array.from(languageSet).sort((a, b) => collator.compare(a, b)),
    extensions: Array.from(extensionSet).sort((a, b) => collator.compare(a, b)),
  };
}

export function useFileCatalog(): FileCatalog | null {
  const data = useStore((state) => state.data);
  const settings = useStore((state) => state.settings);

  return useMemo(() => {
    if (!data?.fileTree) {
      return null;
    }

    const generatedPatterns = settings?.generatedPatterns ?? DEFAULT_GENERATED_PATTERNS;
    const binaryExtensions = buildBinaryExtensionSet(settings?.binaryExtensions);

    return buildFileCatalog(data.fileTree, generatedPatterns, binaryExtensions);
  }, [data?.fileTree, settings?.generatedPatterns, settings?.binaryExtensions]);
}
