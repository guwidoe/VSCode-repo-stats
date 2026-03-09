import type {
  AnalysisResult,
  ExtensionSettings,
  FrequencyGranularity,
  TreemapNode,
} from '../types';

export function computeDefaultGranularity(
  data: AnalysisResult | null,
  settings: ExtensionSettings | null
): FrequencyGranularity {
  if (!settings) {
    return 'weekly';
  }

  const mode = settings.defaultGranularityMode;
  if (mode === 'weekly') {
    return 'weekly';
  }
  if (mode === 'monthly') {
    return 'monthly';
  }
  if (!data) {
    return 'weekly';
  }

  const allWeeks = new Set<string>();
  for (const contributor of data.contributors) {
    for (const week of contributor.weeklyActivity) {
      if (/^\d{4}-W\d{2}$/.test(week.week)) {
        allWeeks.add(week.week);
      }
    }
  }

  return allWeeks.size <= settings.autoGranularityThreshold ? 'weekly' : 'monthly';
}

export function findTreemapNodeByPath(
  rootNode: TreemapNode,
  path: string[]
): TreemapNode {
  let node: TreemapNode | null = rootNode;

  for (const segment of path) {
    if (!node?.children) {
      return rootNode;
    }

    node = node.children.find((child) => child.name === segment) ?? null;
    if (!node) {
      return rootNode;
    }
  }

  return node;
}
