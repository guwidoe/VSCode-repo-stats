import type { AnalysisTargetMember, TreemapNode } from '../../types/index.js';

interface TreeMetrics {
  lines: number;
  bytes: number;
  complexity: number;
  commentLines: number;
  blankLines: number;
  fileCount: number;
}

function cloneNode(node: TreemapNode): TreemapNode {
  return {
    ...node,
    children: node.children?.map((child) => cloneNode(child)),
  };
}

function prefixPath(prefix: string, relativePath: string): string {
  if (!prefix) {
    return relativePath;
  }
  if (!relativePath) {
    return prefix;
  }
  return `${prefix}/${relativePath}`;
}

function applyMemberMetadata(node: TreemapNode, member: Pick<AnalysisTargetMember, 'id' | 'pathPrefix'>): TreemapNode {
  if (node.type === 'file') {
    return {
      ...node,
      path: prefixPath(member.pathPrefix, node.path),
      repositoryId: member.id,
      repositoryRelativePath: node.repositoryRelativePath ?? node.path,
    };
  }

  return {
    ...node,
    path: prefixPath(member.pathPrefix, node.path),
    children: node.children?.map((child) => applyMemberMetadata(child, member)),
  };
}

function ensureDirectory(parent: TreemapNode, name: string, path: string): TreemapNode {
  parent.children = parent.children ?? [];
  let directory = parent.children.find((child) => child.type === 'directory' && child.name === name);
  if (!directory) {
    directory = {
      name,
      path,
      type: 'directory',
      children: [],
    };
    parent.children.push(directory);
  }

  return directory;
}

function mergeChildren(target: TreemapNode, children: TreemapNode[]): void {
  target.children = target.children ?? [];

  for (const child of children) {
    if (child.type === 'directory') {
      const existingDirectory = target.children.find(
        (candidate) => candidate.type === 'directory' && candidate.name === child.name
      );
      if (existingDirectory) {
        mergeChildren(existingDirectory, child.children ?? []);
        continue;
      }
    }

    target.children.push(child);
  }
}

function insertMemberTree(root: TreemapNode, member: AnalysisTargetMember, tree: TreemapNode): void {
  const clonedChildren = (tree.children ?? []).map((child) => applyMemberMetadata(cloneNode(child), member));
  if (!member.pathPrefix) {
    mergeChildren(root, clonedChildren);
    return;
  }

  const segments = member.pathPrefix.split('/').filter((segment) => segment.length > 0);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const currentPath = segments.slice(0, index + 1).join('/');
    current = ensureDirectory(current, segment, currentPath);
  }

  mergeChildren(current, clonedChildren);
}

function recalculateTreeMetrics(node: TreemapNode): TreeMetrics {
  if (node.type === 'file') {
    return {
      lines: node.lines ?? 0,
      bytes: node.bytes ?? 0,
      complexity: node.complexity ?? 0,
      commentLines: node.commentLines ?? 0,
      blankLines: node.blankLines ?? 0,
      fileCount: 1,
    };
  }

  let lines = 0;
  let bytes = 0;
  let complexity = 0;
  let commentLines = 0;
  let blankLines = 0;
  let fileCount = 0;
  let complexityMax = 0;

  for (const child of node.children ?? []) {
    const metrics = recalculateTreeMetrics(child);
    lines += metrics.lines;
    bytes += metrics.bytes;
    complexity += metrics.complexity;
    commentLines += metrics.commentLines;
    blankLines += metrics.blankLines;
    fileCount += metrics.fileCount;
    complexityMax = Math.max(complexityMax, child.type === 'file' ? child.complexity ?? 0 : child.complexityMax ?? 0);
  }

  node.lines = lines;
  node.bytes = bytes;
  node.complexity = complexity;
  node.commentLines = commentLines;
  node.blankLines = blankLines;
  node.fileCount = fileCount;
  node.complexityMax = complexityMax;
  node.complexityAvg = fileCount > 0 ? Math.round(complexity / fileCount) : 0;

  return {
    lines,
    bytes,
    complexity,
    commentLines,
    blankLines,
    fileCount,
  };
}

export function mergeTargetFileTrees(
  trees: Array<{ member: AnalysisTargetMember; tree: TreemapNode }>
): TreemapNode {
  const root: TreemapNode = {
    name: 'root',
    path: '',
    type: 'directory',
    children: [],
  };

  for (const { member, tree } of trees) {
    insertMemberTree(root, member, tree);
  }

  recalculateTreeMetrics(root);
  return root;
}
