import * as crypto from 'crypto';
import simpleGit from 'simple-git';
import {
  createEvolutionRevisionHash,
  createTargetRevisionHash,
} from '../cache/targetCacheKeys.js';
import { createCoreSettingsHash } from '../cache/coreSettingsHash.js';
import { createEvolutionAnalysisSettingsSnapshot } from '../shared/settings.js';
import type {
  AnalysisTarget,
  EvolutionTargetHead,
  ExtensionSettings,
} from '../types/index.js';

export interface TargetStateHashes {
  coreRevisionHash: string;
  coreSettingsHash: string;
  evolutionRevisionHash: string;
  evolutionSettingsHash: string;
}

export async function collectTargetMemberHeads(
  target: AnalysisTarget
): Promise<EvolutionTargetHead[]> {
  return Promise.all(target.members.map(async (member) => {
    const git = simpleGit(member.repoPath);
    const [branchRaw, headShaRaw] = await Promise.all([
      git.revparse(['--abbrev-ref', 'HEAD']),
      git.revparse(['HEAD']),
    ]);

    return {
      repositoryId: member.id,
      repositoryName: member.displayName,
      branch: branchRaw.trim(),
      headSha: headShaRaw.trim(),
    };
  }));
}

export function createTargetStateHashes(
  target: AnalysisTarget,
  settings: ExtensionSettings,
  memberHeads: EvolutionTargetHead[]
): TargetStateHashes {
  return {
    coreRevisionHash: createTargetRevisionHash(
      target,
      memberHeads.map(({ repositoryId, branch, headSha }) => ({
        repositoryId,
        branch,
        headSha,
      }))
    ),
    coreSettingsHash: createCoreSettingsHash(settings),
    evolutionRevisionHash: createEvolutionRevisionHash(memberHeads),
    evolutionSettingsHash: createEvolutionSettingsHash(settings),
  };
}

function createEvolutionSettingsHash(settings: ExtensionSettings): string {
  const payload = JSON.stringify(createEvolutionAnalysisSettingsSnapshot(settings));
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}
