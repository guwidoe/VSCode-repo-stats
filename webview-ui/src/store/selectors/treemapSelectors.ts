import type {
  TreemapFilterPreset,
  TreemapFilterState,
  TreemapNode,
} from '../../types';
import type { SizeDisplayMode } from '../../components/treemap/types';
import { isCodeLanguage } from '../../utils/fileTypes';
import type { RepoStatsState } from '../types';

let cachedFilteredTreemapNode: TreemapNode | null = null;
let cachedFilterParams: {
  node: TreemapNode | null;
  preset: TreemapFilterPreset;
  selectedLanguages: string[];
  sizeMode: SizeDisplayMode;
} | null = null;

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function createTreemapFilterFunction(
  filter: TreemapFilterState,
  forceHideBinaries: boolean = false
): (node: TreemapNode) => boolean {
  switch (filter.preset) {
    case 'hide-binary':
      return (node) => {
        if (node.type === 'directory') {
          return true;
        }
        return !node.binary;
      };

    case 'code-only':
      return (node) => {
        if (node.type === 'directory') {
          return true;
        }
        return !node.binary && isCodeLanguage(node.language);
      };

    case 'custom':
      return (node) => {
        if (node.type === 'directory') {
          return true;
        }
        return filter.selectedLanguages.has(node.language ?? 'Unknown');
      };

    default:
      if (forceHideBinaries) {
        return (node) => {
          if (node.type === 'directory') {
            return true;
          }
          return !node.binary;
        };
      }
      return () => true;
  }
}

function filterTreeNode(
  node: TreemapNode,
  filterFn: (node: TreemapNode) => boolean
): TreemapNode | null {
  if (!filterFn(node)) {
    return null;
  }

  if (node.type === 'file') {
    return { ...node };
  }

  const filteredChildren: TreemapNode[] = [];
  let totalLines = 0;

  for (const child of node.children ?? []) {
    const filteredChild = filterTreeNode(child, filterFn);
    if (filteredChild) {
      filteredChildren.push(filteredChild);
      totalLines += filteredChild.lines ?? 0;
    }
  }

  if (filteredChildren.length === 0) {
    return null;
  }

  return {
    ...node,
    children: filteredChildren,
    lines: totalLines,
  };
}

export const selectFilteredTreemapNode = (state: RepoStatsState): TreemapNode | null => {
  const { currentTreemapNode, treemapFilter, sizeDisplayMode } = state;

  if (!currentTreemapNode) {
    return null;
  }

  const shouldHideBinaries = sizeDisplayMode === 'loc';
  const noFilterNeeded = treemapFilter.preset === 'all' && !shouldHideBinaries;

  if (noFilterNeeded) {
    return currentTreemapNode;
  }

  const selectedLanguagesArray = Array.from(treemapFilter.selectedLanguages).sort();
  if (
    cachedFilterParams &&
    cachedFilterParams.node === currentTreemapNode &&
    cachedFilterParams.preset === treemapFilter.preset &&
    cachedFilterParams.sizeMode === sizeDisplayMode &&
    arraysEqual(cachedFilterParams.selectedLanguages, selectedLanguagesArray)
  ) {
    return cachedFilteredTreemapNode;
  }

  const filterFn = createTreemapFilterFunction(treemapFilter, shouldHideBinaries);
  const filtered = filterTreeNode(currentTreemapNode, filterFn);

  cachedFilterParams = {
    node: currentTreemapNode,
    preset: treemapFilter.preset,
    selectedLanguages: selectedLanguagesArray,
    sizeMode: sizeDisplayMode,
  };
  cachedFilteredTreemapNode = filtered;

  return filtered;
};
