/**
 * Hook that flattens the repository tree into a file catalog for the Files tab.
 */

import { useMemo } from 'react';
import { useStore } from '../../store';
import type { TreemapNode } from '../../types';
import { buildBinaryExtensionSet, isBinaryFile, isCodeLanguage } from '../../utils/fileTypes';
import { getFileExtension, isGeneratedFile } from '../../utils/fileClassification';
import type { FileCatalog, FileRow } from './types';

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
  repositoryLabelsById: Map<string, string>,
  languages: Set<string>,
  extensions: Set<string>
): void {
  if (node.type === 'file') {
    const ext = getFileExtension(node.name);
    const binary =
      node.binary === true ||
      ((node.lines ?? 0) === 0 && isBinaryFile(node.path, binaryExtensions));
    const language = node.language ?? 'Unknown';
    const generated = isGeneratedFile(node.path, generatedPatterns);

    const repositoryId = node.repositoryId ?? '';
    const repository = repositoryLabelsById.get(repositoryId) ?? repositoryId;

    const row: FileRow = {
      path: node.path,
      repositoryId,
      repository,
      name: node.name,
      ext,
      language,
      lines: node.lines ?? 0,
      bytes: node.bytes ?? 0,
      binary,
      generated,
      isCode: isCodeLanguage(language),
      complexity: node.complexity ?? 0,
      commentLines: node.commentLines ?? 0,
      blankLines: node.blankLines ?? 0,
      blamedLines: node.blamedLines ?? 0,
      lineAgeAvgDays: node.lineAgeAvgDays ?? 0,
      lineAgeMinDays: node.lineAgeMinDays ?? 0,
      lineAgeMaxDays: node.lineAgeMaxDays ?? 0,
      topOwnerAuthor: node.topOwnerAuthor ?? '',
      topOwnerEmail: node.topOwnerEmail ?? '',
      topOwnerLines: node.topOwnerLines ?? 0,
      topOwnerShare: node.topOwnerShare ?? 0,
      lastModified: node.lastModified,
      lastModifiedEpoch: toEpoch(node.lastModified),
      pathLower: node.path.toLowerCase(),
      repositoryLower: repository.toLowerCase(),
      nameLower: node.name.toLowerCase(),
      topOwnerAuthorLower: (node.topOwnerAuthor ?? '').toLowerCase(),
    };

    rows.push(row);
    languages.add(language);
    extensions.add(ext);
    return;
  }

  for (const child of node.children ?? []) {
    flattenTree(child, rows, generatedPatterns, binaryExtensions, repositoryLabelsById, languages, extensions);
  }
}

export function buildFileCatalog(
  fileTree: TreemapNode,
  generatedPatterns: string[],
  binaryExtensions: Set<string>,
  repositoryLabelsById: Map<string, string> = new Map()
): FileCatalog {
  const rows: FileRow[] = [];
  const languageSet = new Set<string>();
  const extensionSet = new Set<string>();

  flattenTree(
    fileTree,
    rows,
    generatedPatterns,
    binaryExtensions,
    repositoryLabelsById,
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
    if (!data?.fileTree || !settings) {
      return null;
    }

    const generatedPatterns = settings.generatedPatterns;
    const binaryExtensions = buildBinaryExtensionSet(settings.binaryExtensions);
    const repositoryLabelsById = new Map(
      data.repositories.map((repository) => [repository.id, repository.pathPrefix || repository.name])
    );

    return buildFileCatalog(data.fileTree, generatedPatterns, binaryExtensions, repositoryLabelsById);
  }, [data, settings]);
}
