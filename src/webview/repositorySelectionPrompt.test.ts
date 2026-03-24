import { describe, expect, it } from 'vitest';
import {
  buildRepositorySelectionQuickPickItems,
  createRepositorySelectionMessage,
} from './repositorySelectionPrompt.js';
import type { AnalysisTargetSelection } from './context.js';

function createSelection(): AnalysisTargetSelection {
  return {
    repositories: [
      {
        option: {
          name: 'repo-a',
          path: '/workspace/repo-a',
          source: 'workspace',
          workspaceFolderName: 'workspace-a',
          relativePath: 'packages/repo-a',
        },
        rootUri: { fsPath: '/workspace/repo-a' } as never,
      },
      {
        option: {
          name: 'repo-b',
          path: '/workspace/repo-b',
          source: 'bookmarked',
        },
        rootUri: { fsPath: '/workspace/repo-b' } as never,
      },
    ],
    selectedRepositoryIds: ['/workspace/repo-b'],
    selectedTarget: null,
    selectedTargetOption: null,
    repositoryDiscoveryWarnings: [
      {
        source: 'workspace',
        message: 'scan failed',
        repositoryPath: '/workspace',
      },
    ],
  };
}

describe('repositorySelectionPrompt', () => {
  it('builds quick-pick items with selected state and descriptions', () => {
    const items = buildRepositorySelectionQuickPickItems(createSelection());

    expect(items).toEqual([
      {
        label: 'repo-a',
        description: 'workspace-a • packages/repo-a',
        detail: '/workspace/repo-a',
        picked: false,
        repositoryId: '/workspace/repo-a',
      },
      {
        label: 'repo-b',
        description: 'Bookmarked repository',
        detail: '/workspace/repo-b',
        picked: true,
        repositoryId: '/workspace/repo-b',
      },
    ]);
  });

  it('formats repository discovery warnings for empty states', () => {
    expect(createRepositorySelectionMessage(createSelection().repositoryDiscoveryWarnings)).toContain(
      'Repository discovery encountered problems: workspace: scan failed (/workspace)'
    );
  });
});
